/**
 * @file errors.ts
 * @description The translation layer between what actually broke and what the user is told.
 * Every screen level failure is funneled through this file.
 */

import { logger, reportError } from '@/src/lib/logger';
import type { LogContext } from '@/src/lib/logger';

// A lookup table from error code -> sentence
const FRIENDLY_BY_CODE: Record<string, string> = {
  invalid_credentials: 'That email and password do not match an account.',
  email_not_confirmed: 'Confirm your email address before signing in.',
  otp_expired: 'That code is wrong or has expired. Check it, or send a new one.',
  user_already_exists: 'An account with that email already exists.',
  email_exists: 'An account with that email already exists.',
  weak_password: 'Choose a longer password.',
  same_password: 'Choose a password different from your old one.',
  over_request_rate_limit: 'Too many attempts. Wait a moment and try again.',
  over_email_send_rate_limit: 'Too many emails sent. Wait a moment and try again.',
  mapbox_search_failed: 'Search is not available right now. Try again in a moment.',
  mapbox_directions_failed: 'Directions are not available right now. Try again in a moment.',
  route_not_drivable: 'There is no driving route between these stops.',
  '22023': 'That change is not allowed right now. Refresh and try again.',
  '23505': 'That is already taken.',
  '23514': 'Some of those details are not allowed.',
  '42501': 'You do not have permission to do that.',
  PGRST116: 'We could not find that.',
};

const GENERIC = 'Something went wrong. Please try again.';

// Failures the user caused and can fix themselves (a wrong password or code, sending too fast).
// Nothing is broken, so they're logged quietly instead of raised as errors: no red screen in
// development and no noise in the error reporter
const USER_MISTAKE_CODES = new Set([
  'invalid_credentials',
  'email_not_confirmed',
  'otp_expired',
  'user_already_exists',
  'email_exists',
  'weak_password',
  'same_password',
  'over_request_rate_limit',
  'over_email_send_rate_limit',
]);

// Only provides error code if it is a string
const codeOf = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null) return undefined;
  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? code : undefined;
};

// Translates code to sentence or falls back to the generic sentence if code is not listed.
// hasOwn keeps inherited keys like 'toString' from matching
export const toUserMessage = (error: unknown): string => {
  const code = codeOf(error);
  return code && Object.hasOwn(FRIENDLY_BY_CODE, code) ? FRIENDLY_BY_CODE[code] : GENERIC;
};

// Sends raw error to installed reporter and translate error into something the user can read.
// A user's own mistake is only logged, since the message shown already tells them what to fix
export const reportAndDescribe = (error: unknown, context: LogContext = {}): string => {
  const code = codeOf(error);
  if (code && USER_MISTAKE_CODES.has(code)) logger.info('user error', { ...context, code });
  else reportError(error, context);
  return toUserMessage(error);
};
