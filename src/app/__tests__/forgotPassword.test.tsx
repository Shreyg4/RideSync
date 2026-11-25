// Forgetting a password takes two screens: one sends a code to the email, the next checks the code
// and only then asks for a new password. These check each step reaches the service only with valid
// input, and that the password fields stay hidden until the code goes through.

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import ForgotPasswordScreen from '../(authentication)/forgotPassword';
import ResetPasswordScreen from '../(authentication)/resetPassword';
import { anonymousAuth, renderScreen } from '@/src/test/render';

type View = Awaited<ReturnType<typeof renderScreen>>;

const withEmail = (email: string) => (useLocalSearchParams as jest.Mock).mockReturnValue({ email });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ForgotPasswordScreen', () => {
  it('starts with the email from the login screen and sends it a code', async () => {
    withEmail('rider@example.com');
    const requestPasswordReset = jest.fn(async () => {});
    const view = await renderScreen(<ForgotPasswordScreen />, {
      ...anonymousAuth,
      requestPasswordReset,
    });

    expect(view.getByTestId('forgot-email-input').props.value).toBe('rider@example.com');
    await fireEvent.press(view.getByTestId('forgot-submit'));

    await waitFor(() => expect(requestPasswordReset).toHaveBeenCalledWith('rider@example.com'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/resetPassword',
      params: { email: 'rider@example.com' },
    });
  });

  it('asks for a valid email before sending anything', async () => {
    withEmail('');
    const requestPasswordReset = jest.fn(async () => {});
    const view = await renderScreen(<ForgotPasswordScreen />, {
      ...anonymousAuth,
      requestPasswordReset,
    });

    await fireEvent.press(view.getByTestId('forgot-submit'));

    expect(view.getByText('Enter a valid email')).toBeTruthy();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it('stays put and explains when the code cannot be sent', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    withEmail('rider@example.com');
    const requestPasswordReset = jest.fn(async () => {
      throw { code: 'over_email_send_rate_limit' };
    });
    const view = await renderScreen(<ForgotPasswordScreen />, {
      ...anonymousAuth,
      requestPasswordReset,
    });

    await fireEvent.press(view.getByTestId('forgot-submit'));

    expect(await view.findByTestId('forgot-form-error')).toHaveTextContent(
      'Too many emails sent. Wait a moment and try again.'
    );
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('ResetPasswordScreen', () => {
  const enterCode = async (view: View, code: string) => {
    await fireEvent.changeText(view.getByTestId('reset-code-input'), code);
    await fireEvent.press(view.getByTestId('reset-verify'));
  };

  const enterPassword = async (view: View, password: string, confirm = password) => {
    await fireEvent.changeText(view.getByTestId('reset-password-input'), password);
    await fireEvent.changeText(view.getByTestId('reset-confirm-input'), confirm);
    await fireEvent.press(view.getByTestId('reset-submit'));
  };

  it('asks only for the code until it is verified', async () => {
    withEmail('rider@example.com');
    const view = await renderScreen(<ResetPasswordScreen />, anonymousAuth);

    expect(view.getByTestId('reset-code-input')).toBeTruthy();
    expect(view.queryByTestId('reset-password-input')).toBeNull();
    expect(view.queryByTestId('reset-submit')).toBeNull();
  });

  it('checks the code, then saves the new password', async () => {
    withEmail('rider@example.com');
    const verifyPasswordReset = jest.fn(async () => {});
    const updatePassword = jest.fn(async () => {});
    const view = await renderScreen(<ResetPasswordScreen />, {
      ...anonymousAuth,
      verifyPasswordReset,
      updatePassword,
    });

    await enterCode(view, '123 456');
    expect(verifyPasswordReset).toHaveBeenCalledWith('rider@example.com', '123456');
    expect(updatePassword).not.toHaveBeenCalled();

    await view.findByTestId('reset-password-input');
    expect(view.queryByTestId('reset-code-input')).toBeNull();
    await enterPassword(view, 'new-password');

    await waitFor(() => expect(updatePassword).toHaveBeenCalledWith('new-password'));
  });

  it('does not check a short code', async () => {
    withEmail('rider@example.com');
    const verifyPasswordReset = jest.fn(async () => {});
    const view = await renderScreen(<ResetPasswordScreen />, {
      ...anonymousAuth,
      verifyPasswordReset,
    });

    await enterCode(view, '12');

    expect(view.getByText('Enter the 6-digit code from the email')).toBeTruthy();
    expect(verifyPasswordReset).not.toHaveBeenCalled();
  });

  it('stays on the code step when the code is wrong', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    withEmail('rider@example.com');
    const verifyPasswordReset = jest.fn(async () => {
      throw { code: 'otp_expired' };
    });
    const view = await renderScreen(<ResetPasswordScreen />, {
      ...anonymousAuth,
      verifyPasswordReset,
    });

    await enterCode(view, '123456');

    expect(await view.findByTestId('reset-form-error')).toBeTruthy();
    expect(view.queryByTestId('reset-password-input')).toBeNull();
  });

  it('only saves the password again after the code already worked', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    withEmail('rider@example.com');
    const verifyPasswordReset = jest.fn(async () => {});
    const updatePassword = jest
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce({ code: 'same_password' })
      .mockResolvedValueOnce(undefined);
    const view = await renderScreen(<ResetPasswordScreen />, {
      ...anonymousAuth,
      verifyPasswordReset,
      updatePassword,
    });

    await enterCode(view, '123456');
    await view.findByTestId('reset-password-input');

    await enterPassword(view, 'new-password', 'different');
    expect(view.getByText('Passwords do not match')).toBeTruthy();
    expect(updatePassword).not.toHaveBeenCalled();

    await enterPassword(view, 'old-password');
    expect(await view.findByTestId('reset-form-error')).toHaveTextContent(
      'Choose a password different from your old one.'
    );

    await enterPassword(view, 'brand-new-password');

    await waitFor(() => expect(updatePassword).toHaveBeenCalledTimes(2));
    expect(verifyPasswordReset).toHaveBeenCalledTimes(1);
  });
});
