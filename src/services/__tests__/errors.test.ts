import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { toUserMessage, reportAndDescribe } from '../errors';
import { setErrorReporter } from '@/src/lib/logger';

const FRIENDLY_BY_CODE: Record<string, string> = {
  invalid_credentials: 'That email and password do not match an account.',
  '42501': 'You do not have permission to do that.',
  PGRST116: 'We could not find that.',
};

const GENERIC = 'Something went wrong. Please try again.';

afterEach(() => {
  setErrorReporter(null);
});

describe('toUserMessage', () => {
  it.each([
    ['Auth Code', { code: 'invalid_credentials' }, FRIENDLY_BY_CODE['invalid_credentials']],
    ['Postgres Code', { code: '42501' }, FRIENDLY_BY_CODE['42501']],
    ['PostgREST Code', { code: 'PGRST116' }, FRIENDLY_BY_CODE['PGRST116']],
    [
      'Error instance with code property',
      Object.assign(new Error('You do not have permission to do that.'), { code: '42501' }),
      FRIENDLY_BY_CODE['42501'],
    ],
  ])('handles %s correctly', (_, errorInput, expectedMessage) => {
    const result = toUserMessage(errorInput);

    expect(result).toBe(expectedMessage);
  });

  it.each([
    ['null', null],
    ['a string', 'boom'],
    ['an object without a code', {}],
    ['a non-string code', { code: 123 }],
    ['an unknown code', { code: 'nope' }],
    ['an inherited Object key', { code: 'toString' }],
  ])('falls back to the generic message for %s', (_, errorInput) => {
    expect(toUserMessage(errorInput)).toBe(GENERIC);
  });
});

describe('reportAndDescribe', () => {
  let reporter: jest.Mock;
  beforeEach(() => {
    reporter = jest.fn();
    setErrorReporter(reporter);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('passes the raw error and context to the reporter', () => {
    const error = { code: '42501' };
    const context = { scope: 'test' };

    reportAndDescribe(error, context);

    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter).toHaveBeenCalledWith(error, { scope: 'test' });

    expect(reporter.mock.calls[0][0]).toBe(error);
  });

  it('returns the friendly message', () => {
    expect(reportAndDescribe({ code: '42501' }, { scope: 'test' })).toBe(FRIENDLY_BY_CODE['42501']);
  });

  it('reports an unknown error and returns the generic message', () => {
    const error = { code: 'nope' };

    const result = reportAndDescribe(error, { scope: 'test' });

    expect(reporter).toHaveBeenCalledWith(error, { scope: 'test' });
    expect(result).toBe(GENERIC);
  });

  it('defaults the context to an empty object', () => {
    const error = { code: '42501' };

    reportAndDescribe(error);

    expect(reporter).toHaveBeenCalledWith(error, {});
  });

  it('still returns the friendly message when the reporter throws', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    reporter.mockImplementation(() => {
      throw new Error('reporter down');
    });

    expect(reportAndDescribe({ code: '42501' }, { scope: 'test' })).toBe(FRIENDLY_BY_CODE['42501']);
  });
});
