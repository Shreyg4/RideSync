import { reportError } from '@/src/lib/logger';
import type { LogContext } from '@/src/lib/logger';

const FRIENDLY_BY_CODE: Record<string, string> = {
  invalid_credentials: 'That email and password do not match an account.',
  email_not_confirmed: 'Confirm your email address before signing in.',
  user_already_exists: 'An account with that email already exists.',
  email_exists: 'An account with that email already exists.',
  weak_password: 'Choose a longer password.',
  over_request_rate_limit: 'Too many attempts. Wait a moment and try again.',
  over_email_send_rate_limit: 'Too many emails sent. Wait a moment and try again.',
  '23505': 'That is already taken.',
  '23514': 'Some of those details are not allowed.',
  '42501': 'You do not have permission to do that.',
  PGRST116: 'We could not find that.',
};

const GENERIC = 'Something went wrong. Please try again.';

const codeOf = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null) return undefined;
  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? code : undefined;
};

export const toUserMessage = (error: unknown): string => {
  const code = codeOf(error);
  return (code && FRIENDLY_BY_CODE[code]) || GENERIC;
};

export const reportAndDescribe = (error: unknown, context: LogContext = {}): string => {
  reportError(error, context);
  return toUserMessage(error);
};
