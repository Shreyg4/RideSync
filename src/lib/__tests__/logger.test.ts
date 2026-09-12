// Redaction is the part of the logger that has to be right: everything else is a console
// call. These cover the shapes a Supabase failure actually arrives in.

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { logger, redact, reportError, setErrorReporter } from '../logger';

const consoleSpies = {
  log: jest.spyOn(console, 'log').mockImplementation(() => {}),
  warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
  error: jest.spyOn(console, 'error').mockImplementation(() => {}),
};

beforeEach(() => {
  Object.values(consoleSpies).forEach((spy) => spy.mockClear());
});

afterEach(() => {
  setErrorReporter(null);
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
