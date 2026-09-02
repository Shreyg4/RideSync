/** Severity of a log line. `debug` is for breadcrumbs, `error` for failures worth reporting. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Structured data attached to a log line. Redacted before it is printed or reported. */
export type LogContext = Record<string, unknown>;

/** Sink for reportError(). Swap Sentry's captureException in here via setErrorReporter(). */
export type ErrorReporter = (error: unknown, context: LogContext) => void;

const REDACTED = '[redacted]';
const TRUNCATED = '[truncated]';

// Depth and width caps: context objects come from callers, and a Supabase error or a
// navigation state can be deep enough to make a log line useless (or slow to serialise).
const MAX_DEPTH = 4;
const MAX_ARRAY_ITEMS = 20;
const MAX_STRING_LENGTH = 512;

// Matched against the *segments* of a key, so `accessToken`, `access_token` and
// `ACCESS-TOKEN` all reduce to ['access', 'token'] and hit `token`. Over-redacting is the
// safe failure here, so the list errs wide.
const SENSITIVE_KEY_SEGMENTS = new Set([
  'auth',
  'authorization',
  'credential',
  'credentials',
  'email',
  'jwt',
  'key',
  'mail',
  'otp',
  'pass',
  'passcode',
  'password',
  'secret',
  'session',
  'token',
]);

const keySegments = (key: string) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());

const isSensitiveKey = (key: string) =>
  keySegments(key).some((segment) => SENSITIVE_KEY_SEGMENTS.has(segment));

// Value-level patterns, for secrets that arrive inside an otherwise innocent string - a
// Supabase error message quoting the email it rejected, say.
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const JWT_PATTERN = /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const AUTH_SCHEME_PATTERN = /\b(bearer|basic)\s+[\w\-._~+/]+=*/gi;

const redactString = (value: string) => {
  const clean = value
    .replace(JWT_PATTERN, REDACTED)
    .replace(AUTH_SCHEME_PATTERN, (_match, scheme: string) => `${scheme} ${REDACTED}`)
    .replace(EMAIL_PATTERN, REDACTED);

  return clean.length > MAX_STRING_LENGTH ? `${clean.slice(0, MAX_STRING_LENGTH)}…` : clean;
};

const redactError = (error: Error, depth: number) => {
  const { name, message, stack, cause } = error;
  return {
    name,
    message: redactString(message),
    // Stacks are noise in a release breadcrumb and can quote source lines.
    ...(__DEV__ && stack ? { stack } : {}),
    ...(cause === undefined ? {} : { cause: redactValue(cause, depth + 1) }),
  };
};

const redactValue = (value: unknown, depth: number): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function' || typeof value === 'symbol') return `[${typeof value}]`;
  if (value instanceof Error) return redactError(value, depth);
  if (depth >= MAX_DEPTH) return TRUNCATED;

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => redactValue(item, depth + 1));
    return value.length > MAX_ARRAY_ITEMS
      ? [...items, `${TRUNCATED} (${value.length - MAX_ARRAY_ITEMS} more)`]
      : items;
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        isSensitiveKey(key) ? REDACTED : redactValue(entry, depth + 1),
      ])
    );
  }

  return TRUNCATED;
};

/**
 * Strips credentials out of a context object: values under a sensitive key (`password`,
 * `accessToken`, `email`, …) are replaced wholesale, and every remaining string is scrubbed
 * of emails, JWTs and `Bearer …` headers. Exported for tests; callers get it for free.
 */
export const redact = (context: LogContext): LogContext => redactValue(context, 0) as LogContext;

const CONSOLE_METHOD: Record<LogLevel, 'log' | 'info' | 'warn' | 'error'> = {
  debug: 'log',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

// Release builds have no console anyone can read, so nothing is printed there. Production
// visibility is reportError()'s job, not the console's.
const write = (level: LogLevel, message: string, context?: LogContext) => {
  if (!__DEV__) return;

  const line = `[${level}] ${redactString(message)}`;
  const method = CONSOLE_METHOD[level];

  if (context && Object.keys(context).length > 0) {
    console[method](line, redact(context));
  } else {
    console[method](line);
  }
};

export const logger = {
  debug: (message: string, context?: LogContext) => write('debug', message, context),
  info: (message: string, context?: LogContext) => write('info', message, context),
  warn: (message: string, context?: LogContext) => write('warn', message, context),
  error: (message: string, context?: LogContext) => write('error', message, context),
};

let errorReporter: ErrorReporter | null = null;

/** Installs the crash reporter (Sentry, etc.). Pass null to remove it. */
export const setErrorReporter = (reporter: ErrorReporter | null) => {
  errorReporter = reporter;
};

const messageOf = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
};

/**
 * The single seam every catch block routes through. Logs in development and forwards to the
 * installed reporter in every build, so a failure is never swallowed silently.
 *
 * @param error   Whatever was caught - an Error, a Supabase error object, anything.
 * @param context Where it happened and what mattered: `{ scope: 'authService.signIn' }`.
 *                Credentials are redacted, but never pass the Supabase session itself.
 */
export const reportError = (error: unknown, context: LogContext = {}) => {
  write('error', messageOf(error), { ...context, error });

  if (!errorReporter) return;
  try {
    errorReporter(error, redact(context));
  } catch (reporterError) {
    // A reporter that throws must not take down the code path that was already failing.
    write('warn', 'error reporter threw', { error: reporterError });
  }
};
