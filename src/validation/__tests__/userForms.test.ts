import { describe, expect, it } from '@jest/globals';
import {
  isUsernameCandidate,
  normalizeEmail,
  normalizeSignUpForm,
  validateLoginForm,
  validateSignUpForm,
} from '../userForms';

const form = {
  firstName: 'Shreyas',
  lastName: 'Ganesh',
  username: 'shreyas',
  email: 'rider@example.com',
};

describe('normalizeSignUpForm', () => {
  it('trims every field and lower-cases the email', () => {
    expect(
      normalizeSignUpForm({
        firstName: '  Shreyas ',
        lastName: ' Ganesh  ',
        username: ' shreyas ',
        email: '  Rider@Example.COM ',
      })
    ).toEqual(form);
  });
});

describe('validateSignUpForm', () => {
  it('accepts a valid form', () => {
    expect(validateSignUpForm(form, 'longenough', 'longenough')).toEqual({});
  });

  it('requires both names', () => {
    const errors = validateSignUpForm(
      { ...form, firstName: '', lastName: '' },
      'longenough',
      'longenough'
    );
    expect(errors.firstName).toBe('Required');
    expect(errors.lastName).toBe('Required');
  });

  it('reports length before format, so a short name gets the useful message', () => {
    expect(
      validateSignUpForm({ ...form, username: 'a!' }, 'longenough', 'longenough').username
    ).toBe('At least 5 characters');
  });

  it('rejects a long-enough username with illegal characters', () => {
    expect(
      validateSignUpForm({ ...form, username: 'not-allowed' }, 'longenough', 'longenough').username
    ).toBe('Letters, numbers and underscores only');
  });

  it('rejects a password under the shared minimum', () => {
    expect(validateSignUpForm(form, 'short', 'short').password).toBe('Password is not long enough');
  });

  it('rejects mismatched passwords', () => {
    expect(validateSignUpForm(form, 'longenough', 'different').confirmPassword).toBe(
      'Passwords do not match'
    );
  });

  it('rejects an email with no @', () => {
    expect(validateSignUpForm({ ...form, email: 'nope' }, 'longenough', 'longenough').email).toBe(
      'Enter a valid email'
    );
  });
});

describe('validateLoginForm', () => {
  it('accepts an email and a password', () => {
    expect(validateLoginForm('rider@example.com', 'anything')).toEqual({});
  });

  it('does not enforce the signup password policy, so old accounts can still sign in', () => {
    expect(validateLoginForm('rider@example.com', 'ab')).toEqual({});
  });

  it('flags a missing password and a malformed email', () => {
    expect(validateLoginForm('nope', '')).toEqual({
      email: 'Enter valid email',
      password: 'Required',
    });
  });
});

describe('isUsernameCandidate', () => {
  it.each([
    ['shreyas', true],
    ['user_1', true],
    ['abcd', false],
    ['has-dash', false],
    ['has space', false],
  ])('%s -> %s', (candidate, expected) => {
    expect(isUsernameCandidate(candidate)).toBe(expected);
  });
});

describe('normalizeEmail', () => {
  it('matches what the signup screen stored', () => {
    expect(normalizeEmail('  Rider@Example.COM ')).toBe('rider@example.com');
  });
});
