import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import LoginScreen from '../(authentication)/login';
import { anonymousAuth, renderScreen } from '@/src/test/render';

type View = Awaited<ReturnType<typeof renderScreen>>;

const submit = async (view: View, email: string, password: string) => {
  await fireEvent.changeText(view.getByTestId('email-input'), email);
  await fireEvent.changeText(view.getByTestId('password-input'), password);
  await fireEvent.press(view.getByTestId('login-submit'));
};

describe('LoginScreen', () => {
  it('does not reach the service when the email is malformed', async () => {
    const signIn = jest.fn(async () => {});
    const view = await renderScreen(<LoginScreen />, { ...anonymousAuth, signIn });

    await submit(view, 'not-an-email', 'whatever');

    expect(view.getByText('Enter valid email')).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('flags a missing password', async () => {
    const signIn = jest.fn(async () => {});
    const view = await renderScreen(<LoginScreen />, { ...anonymousAuth, signIn });

    await submit(view, 'rider@example.com', '');

    expect(view.getByText('Required')).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('normalises the email before handing it to the service', async () => {
    const signIn = jest.fn(async () => {});
    const view = await renderScreen(<LoginScreen />, { ...anonymousAuth, signIn });

    await submit(view, '  Rider@Example.COM ', 'hunter2222');

    await waitFor(() => expect(signIn).toHaveBeenCalledWith('rider@example.com', 'hunter2222'));
  });

  it('does not apply the signup password policy, so older accounts can still sign in', async () => {
    const signIn = jest.fn(async () => {});
    const view = await renderScreen(<LoginScreen />, { ...anonymousAuth, signIn });

    await submit(view, 'rider@example.com', 'ab');

    await waitFor(() => expect(signIn).toHaveBeenCalled());
  });

  it('shows friendly copy rather than the raw server error', async () => {
    const signIn = jest.fn(async () => {
      throw Object.assign(new Error('Invalid login credentials'), { code: 'invalid_credentials' });
    });
    const view = await renderScreen(<LoginScreen />, { ...anonymousAuth, signIn });

    await submit(view, 'rider@example.com', 'hunter2222');

    await waitFor(() =>
      expect(view.getByText('That email and password do not match an account.')).toBeTruthy()
    );
    expect(view.queryByText('Invalid login credentials')).toBeNull();
  });

  it('falls back to a generic message for an unrecognised failure', async () => {
    const signIn = jest.fn(async () => {
      throw new Error('Database error at 10.0.0.4:5432');
    });
    const view = await renderScreen(<LoginScreen />, { ...anonymousAuth, signIn });

    await submit(view, 'rider@example.com', 'hunter2222');

    await waitFor(() =>
      expect(view.getByText('Something went wrong. Please try again.')).toBeTruthy()
    );
    expect(view.queryByText('Database error at 10.0.0.4:5432')).toBeNull();
  });

  it('clears a field error as soon as that field is edited', async () => {
    const view = await renderScreen(<LoginScreen />, anonymousAuth);

    await submit(view, 'bad', '');
    expect(view.getByText('Enter valid email')).toBeTruthy();

    await fireEvent.changeText(view.getByTestId('email-input'), 'rider@example.com');

    expect(view.queryByText('Enter valid email')).toBeNull();
  });
});
