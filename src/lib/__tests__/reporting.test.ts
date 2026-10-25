// reporting.ts is the last gate before anything leaves the device, so these check that nothing
// reaches Sentry unredacted and that logger.ts's two sinks land on the right Sentry calls.

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as Sentry from '@sentry/react-native';
import type { SeverityLevel } from '@sentry/react-native';
import { logger, reportError, type LogLevel } from '../logger';
import '../reporting';

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  mobileReplayIntegration: jest.fn(() => ({ name: 'MobileReplay' })),
}));

// Read once: Sentry.init runs at import, before any beforeEach clears the mock
const options = jest.mocked(Sentry.init).mock.calls[0][0];
type SentryEvent = Parameters<NonNullable<typeof options.beforeSend>>[0];

// beforeSend is synchronous, so its result can be used directly
const beforeSend = (fields: Partial<SentryEvent>) =>
  options.beforeSend!({ type: undefined, ...fields } as SentryEvent, {}) as SentryEvent;

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln';

beforeEach(() => {
  jest.clearAllMocks();
  // The logger also prints in development; keep the test output clean
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Sentry.init', () => {
  it(`keeps Sentry's own collection off: no default PII, replays only for sessions with an error`, () => {
    expect(options.sendDefaultPii).toBe(false);
    expect(options.replaysSessionSampleRate).toBe(0);
    expect(options.replaysOnErrorSampleRate).toBe(1);
  });
});

describe('beforeSend', () => {
  it('scrubs emails and credentials out of exception values', () => {
    const event = beforeSend({
      exception: {
        values: [
          { type: 'Error', value: 'no user rider@example.com' },
          { type: 'AuthApiError', value: 'rejected Bearer abc.def' },
        ],
      },
    });

    expect(event.exception?.values?.map((value) => value.value)).toEqual([
      'no user [redacted]',
      'rejected Bearer [redacted]',
    ]);
  });

  it('scrubs the event message', () => {
    expect(beforeSend({ message: 'sign up failed for rider@example.com' }).message).toBe(
      'sign up failed for [redacted]'
    );
  });

  it('scrubs breadcrumbs Sentry recorded on its own, which never went through the logger', () => {
    const event = beforeSend({
      breadcrumbs: [
        {
          category: 'console',
          message: `token ${JWT}`,
          data: { email: 'rider@example.com', screen: 'login', note: 'sent to rider@example.com' },
        },
      ],
    });

    expect(event.breadcrumbs).toEqual([
      {
        category: 'console',
        message: 'token [redacted]',
        data: { email: '[redacted]', screen: 'login', note: 'sent to [redacted]' },
      },
    ]);
  });

  it('still sends an event that has nothing to scrub', () => {
    const bare = { exception: { values: [{ type: 'Error' }] }, breadcrumbs: [{ category: 'ui' }] };

    expect(beforeSend(bare)).toEqual({ type: undefined, ...bare });
    expect(beforeSend({})).toEqual({ type: undefined });
  });
});

describe('error reporter', () => {
  it('sends reportError to Sentry as an exception, with the redacted context as extra', () => {
    const error = new Error('insert failed');

    reportError(error, { scope: 'createTrip', email: 'rider@example.com' });

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      extra: { scope: 'createTrip', email: '[redacted]' },
    });
  });

  it('hands over the raw error itself, so its stack still symbolicates', () => {
    const error = new Error('insert failed');

    reportError(error);

    expect(jest.mocked(Sentry.captureException).mock.calls[0][0]).toBe(error);
  });
});

describe('breadcrumb sink', () => {
  it.each<[LogLevel, SeverityLevel]>([
    ['debug', 'debug'],
    ['info', 'info'],
    ['warn', 'warning'],
    ['error', 'error'],
  ])('turns logger.%s into a Sentry %s breadcrumb', (level, sentryLevel) => {
    logger[level]('opened trip', { tripId: 7 });

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      level: sentryLevel,
      message: 'opened trip',
      data: { tripId: 7 },
    });
  });

  it('only ever receives the redacted message and context', () => {
    logger.info('signed in as rider@example.com', { session: 'abc', screen: 'login' });

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      level: 'info',
      message: 'signed in as [redacted]',
      data: { session: '[redacted]', screen: 'login' },
    });
  });
});
