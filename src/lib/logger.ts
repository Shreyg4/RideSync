/**
 * @file logger.ts
 * @description All logs/errors funnel through this file, which redacts every message and
 * context before it is printed or handed to a sink. The one deliberate exception is the raw
 * error handed to reportError()'s reporter - see the note there.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Structured data attached to a log line. Redacted before it is printed or reported.
export type LogContext = Record<string, unknown>;

// Sink for reportError(). Kept as a slot so this file never imports Sentry.
export type ErrorReporter = (error: unknown, context: LogContext) => void;
let errorReporter: ErrorReporter | null = null;
export const setErrorReporter = (reporter: ErrorReporter | null) => {
  errorReporter = reporter;
};

// Sink for breadcrumbs, fed by logger.* and by reportError() alike
export type BreadcrumbSink = (level: LogLevel, message: string, context?: LogContext) => void;
let breadcrumbSink: BreadcrumbSink | null = null;
export const setBreadcrumbSink = (sink: BreadcrumbSink | null) => {
  breadcrumbSink = sink;
};

const REDACTED = '[redacted]';
const TRUNCATED = '[truncated]';

// Caps applied to the message and to every context value, so one oversized argument cannot
// make a log line unreadable or slow to serialize
// Bounds recursion, and with no seen-set it doubles as the cycle guard wherever it is reached.
// redactError() returns above the check though, so a looping error.cause chain escapes it.
const MAX_DEPTH = 4;
const MAX_ARRAY_ITEMS = 20;
const MAX_STRING_LENGTH = 512;

// Word segments extracted from a key (key-based redaction). Matching is exact per segment, so
// plurals need their own entry. Over-redacting is the safe failure, so the list errs wide.
const SENSITIVE_KEY_SEGMENTS = new Set([
  'auth',
  'authorization',
  'credential',
  'credentials',
  'email',
  'emails',
  'jwt',
  'jwts',
  'key',
  'keys',
  'mail',
  'otp',
  'otps',
  'pass',
  'passcode',
  'passcodes',
  'password',
  'passwords',
  'secret',
  'secrets',
  'session',
  'sessions',
  'token',
  'tokens',
]);

// Normalizes a key into individual words to be compared against SENSITIVE_KEY_SEGMENTS
const keySegments = (key: string) =>
  key
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // split acronyms: JWTToken -> JWT Token
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // split camelCase
    .split(/[^a-zA-Z0-9]+/) // split on everything else
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());

// As long as one word in the key matches something in SENSITIVE_KEY_SEGMENTS, it is a sensitive key and must be redacted
const isSensitiveKey = (key: string) =>
  keySegments(key).some((segment) => SENSITIVE_KEY_SEGMENTS.has(segment));

// Value-based redaction, for secrets that arrive inside an otherwise innocent string
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const JWT_PATTERN = /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const AUTH_SCHEME_PATTERN = /\b(bearer|basic)\s+[\w\-._~+/]+=*/gi; // keeps scheme, replaces credential

// Applies redaction to log messages and truncates value
export const redactString = (value: string) => {
  const clean = value
    .replace(JWT_PATTERN, REDACTED)
    .replace(AUTH_SCHEME_PATTERN, (_match, scheme: string) => `${scheme} ${REDACTED}`)
    .replace(EMAIL_PATTERN, REDACTED);

  return clean.length > MAX_STRING_LENGTH ? `${clean.slice(0, MAX_STRING_LENGTH)}…` : clean;
};

// Decides what part of an Error to redact and how to present it
const redactError = (error: Error, depth: number) => {
  const { name, message, stack, cause } = error;
  return {
    // Custom fields are enumerable own props, so a spread picks them up and skips message/stack.
    ...(redactValue({ ...error }, depth + 1) as object),
    name,
    message: redactString(message),
    ...(__DEV__ && stack ? { stack } : {}),
    ...(cause === undefined ? {} : { cause: redactValue(cause, depth + 1) }),
  };
};

// Decides what values will be redacted or not and how their output will look
const redactValue = (value: unknown, depth: number): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function' || typeof value === 'symbol') return `[${typeof value}]`;

  // Checked ahead of the Error branch: redactError() re-enters through `cause`, so a cyclic
  // cause chain is only bounded if the counter is consulted before the error is unwrapped.
  if (depth >= MAX_DEPTH) return TRUNCATED;
  if (value instanceof Error) return redactError(value, depth);

  // shows up to MAX_ARRAY_ITEMS entries, then a (N more) tail marker
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => redactValue(item, depth + 1));
    return value.length > MAX_ARRAY_ITEMS
      ? [...items, `${TRUNCATED} (${value.length - MAX_ARRAY_ITEMS} more)`]
      : items;
  }

  // recurse each entry except where key is sensitive
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

// Starts the redaction process and seeds depth at 0 so callers never see the counter
export const redact = (context: LogContext): LogContext => redactValue(context, 0) as LogContext;

// Maps a log level to the console method it prints with. The Record type forces every
// LogLevel to have an entry, so adding a new level fails to compile until it is mapped.
const CONSOLE_METHOD: Record<LogLevel, 'log' | 'info' | 'warn' | 'error'> = {
  debug: 'log',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

// Every log line in the app passes through this function to get redacted, then reaches the
// breadcrumb sink in every build and the console in development only. The error reporter is
// not called here - that sink belongs to reportError().
const write = (level: LogLevel, message: string, context?: LogContext) => {
  const safeMessage = redactString(message);
  const safeContext = context && Object.keys(context).length > 0 ? redact(context) : undefined;

  if (breadcrumbSink) {
    try {
      breadcrumbSink(level, safeMessage, safeContext);
    } catch {
      // A sink that throws must not break the code path that was logging.
    }
  }

  if (!__DEV__) return;

  const method = CONSOLE_METHOD[level];
  const line = `[${level}] ${safeMessage}`;
  if (safeContext) console[method](line, safeContext);
  else console[method](line);
};

// The public logging API. Each level is a thin wrapper over write(), so every log line in
// the app goes through the same redaction and reaches the breadcrumb sink in every build.
export const logger = {
  debug: (message: string, context?: LogContext) => write('debug', message, context),
  info: (message: string, context?: LogContext) => write('info', message, context),
  warn: (message: string, context?: LogContext) => write('warn', message, context),
  error: (message: string, context?: LogContext) => write('error', message, context),
};

// Pulls a printable message out of whatever a catch block caught.
const messageOf = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
};

// The single seam every catch block routes through. Uses the error and context of the error to
// log in development and forward to the installed reporter (Sentry) so everything is recorded
export const reportError = (error: unknown, context: LogContext = {}) => {
  write('error', messageOf(error), { ...context, error });

  if (!errorReporter) return;
  try {
    // The raw error goes to reporter unredacted so stacks symbolicate; only context is scrubbed.
    errorReporter(error, redact(context)); 
  } catch (reporterError) {
    // A reporter that throws must not take down the code path that was already failing.
    write('warn', 'error reporter threw', { error: reporterError });
  }
};
