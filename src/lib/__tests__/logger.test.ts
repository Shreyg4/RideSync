// Redaction is the part of the logger that has to be right: everything else is a console
// call. These cover the shapes a Supabase failure actually arrives in.

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { logger, redact, reportError, setBreadcrumbSink, setErrorReporter } from '../logger';

const consoleSpies = {
  log: jest.spyOn(console, 'log').mockImplementation(() => {}),
  info: jest.spyOn(console, 'info').mockImplementation(() => {}),
  warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
  error: jest.spyOn(console, 'error').mockImplementation(() => {}),
};

beforeEach(() => {
  Object.values(consoleSpies).forEach((spy) => spy.mockClear());
});

afterEach(() => {
  setErrorReporter(null);
  setBreadcrumbSink(null);
});

describe('redact', () => {
  it('replaces values under a sensitive key, whatever its casing', () => {
    expect(
      redact({
        password: 'hunter2',
        access_token: 'abc',
        refreshToken: 'def',
        'API-KEY': 'ghi',
        username: 'shreyas',
      })
    ).toEqual({
      password: '[redacted]',
      access_token: '[redacted]',
      refreshToken: '[redacted]',
      'API-KEY': '[redacted]',
      username: 'shreyas',
    });
  });

  it('scrubs emails, JWTs and auth headers out of free text', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.7bXQ-signature';

    expect(
      redact({
        detail: 'signup failed for rider@example.com',
        header: `Bearer ${jwt}`,
      })
    ).toEqual({
      detail: 'signup failed for [redacted]',
      header: 'Bearer [redacted]',
    });
  });

  it('walks nested objects and arrays', () => {
    expect(redact({ user: { id: 7, session: { access_token: 'abc' } }, tags: ['a', 'b'] })).toEqual(
      {
        user: { id: 7, session: '[redacted]' },
        tags: ['a', 'b'],
      }
    );
  });

  it('serialises an Error instead of dropping it to {}', () => {
    const scrubbed = redact({ error: new TypeError('bad email: rider@example.com') }) as {
      error: { name: string; message: string };
    };

    expect(scrubbed.error.name).toBe('TypeError');
    expect(scrubbed.error.message).toBe('bad email: [redacted]');
  });

  it('truncates past the depth cap rather than recursing forever', () => {
    const cyclic: Record<string, unknown> = { name: 'root' };
    cyclic.self = cyclic;

    expect(() => redact(cyclic)).not.toThrow();
    expect(JSON.stringify(redact(cyclic))).toContain('[truncated]');
  });
});

describe('logger', () => {
  it('prints the level and the redacted context', () => {
    logger.warn('upload failed', { email: 'rider@example.com', attempt: 2 });

    expect(consoleSpies.warn).toHaveBeenCalledWith('[warn] upload failed', {
      email: '[redacted]',
      attempt: 2,
    });
  });

  it('redacts the message itself', () => {
    logger.debug('checking rider@example.com');

    expect(consoleSpies.log).toHaveBeenCalledWith('[debug] checking [redacted]');
  });
});

describe('reportError', () => {
  it('forwards the error and a redacted context to the installed reporter', () => {
    const reporter = jest.fn();
    setErrorReporter(reporter);

    const error = new Error('nope');
    reportError(error, { scope: 'authService.signIn', password: 'hunter2' });

    expect(reporter).toHaveBeenCalledWith(error, {
      scope: 'authService.signIn',
      password: '[redacted]',
    });
  });

  it('survives a reporter that throws', () => {
    setErrorReporter(() => {
      throw new Error('reporter is down');
    });

    expect(() => reportError(new Error('original'))).not.toThrow();
    expect(consoleSpies.warn).toHaveBeenCalledWith(
      '[warn] error reporter threw',
      expect.anything()
    );
  });

  it('logs non-Error values too', () => {
    reportError({ code: '23505' }, { scope: 'userService.create' });

    expect(consoleSpies.error).toHaveBeenCalledWith(
      '[error] Unknown error',
      expect.objectContaining({ scope: 'userService.create' })
    );
  });
});

// The breadcrumb sink is the one path that runs in release builds, so what reaches it is
// what reaches Sentry. These pin the redaction down at that boundary.
describe('breadcrumb sink', () => {
  it('receives the level and the redacted message and context', () => {
    const sink = jest.fn();
    setBreadcrumbSink(sink);

    logger.info('signing in rider@example.com', { accessToken: 'abc', attempt: 2 });

    expect(sink).toHaveBeenCalledWith('info', 'signing in [redacted]', {
      accessToken: '[redacted]',
      attempt: 2,
    });
  });

  it('passes no context rather than an empty object', () => {
    const sink = jest.fn();
    setBreadcrumbSink(sink);

    logger.debug('no context here');

    expect(sink).toHaveBeenCalledWith('debug', 'no context here', undefined);
  });

  it('fires for reportError too, carrying the redacted error', () => {
    const sink = jest.fn();
    setBreadcrumbSink(sink);

    reportError(new Error('signup failed for rider@example.com'), { scope: 'authService' });

    expect(sink).toHaveBeenCalledWith(
      'error',
      'signup failed for [redacted]',
      expect.objectContaining({ scope: 'authService' })
    );
  });

  it('survives a sink that throws', () => {
    setBreadcrumbSink(() => {
      throw new Error('sink is down');
    });

    expect(() => logger.info('still fine')).not.toThrow();
    // The console line is still written: a broken sink must not cost us the log.
    expect(consoleSpies.info).toHaveBeenCalledWith('[info] still fine');
  });
});
