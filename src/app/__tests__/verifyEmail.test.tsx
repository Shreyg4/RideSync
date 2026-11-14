// The screen that proves a new account's email is real. These pin what it sends to Supabase, what
// happens once the code goes through, and how the resend countdown behaves

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import type { User } from '@supabase/supabase-js';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert } from 'react-native';
import VerifyEmailScreen from '../(authentication)/verifyEmail';
import type { AuthContextType } from '@/src/context/AuthProvider';
import { uploadAvatar } from '@/src/services/avatarService';
import { mockAlert } from '@/src/test/alert';
import { anonymousAuth, renderScreen } from '@/src/test/render';
import { RESEND_CODE_COOLDOWN_SECONDS } from '@/src/validation/userForms';

jest.mock('@/src/services/avatarService', () => ({
  uploadAvatar: jest.fn(),
  avatarUrl: jest.fn(),
}));

type View = Awaited<ReturnType<typeof renderScreen>>;

const user = { id: 'user-1' } as User;

const withParams = (params: Record<string, string>) =>
  jest.mocked(useLocalSearchParams).mockReturnValue(params);

const renderVerify = async (auth: Partial<AuthContextType> = {}) => {
  const verifyEmail = jest.fn<AuthContextType['verifyEmail']>(async () => user);
  const resendVerification = jest.fn<AuthContextType['resendVerification']>(async () => {});
  const view = await renderScreen(<VerifyEmailScreen />, {
    ...anonymousAuth,
    verifyEmail,
    resendVerification,
    ...auth,
  });
  return { view, verifyEmail, resendVerification };
};

const typeCode = (view: View, code: string) =>
  fireEvent.changeText(view.getByTestId('verify-code-input'), code);

const submit = (view: View) => fireEvent.press(view.getByTestId('verify-submit'));

// The countdown sets its next one-second timer after each tick renders, so time moves a second at
// a time
const wait = async (seconds: number) => {
  for (let i = 0; i < seconds; i++) {
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
  }
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockAlert();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.mocked(uploadAvatar).mockResolvedValue('user-1/1767225600000.png');
  withParams({ email: 'ana@example.com' });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('VerifyEmailScreen', () => {
  it('says where the code went', async () => {
    const { view } = await renderVerify();

    expect(view.getByText('ana@example.com')).toBeTruthy();
  });

  it('keeps only digits, up to the code length', async () => {
    const { view } = await renderVerify();

    await typeCode(view, '12 34-5678');

    expect(view.getByTestId('verify-code-input').props.value).toBe('123456');
  });

  it('asks for the whole code before checking it', async () => {
    const { view, verifyEmail } = await renderVerify();
    await typeCode(view, '123');

    await submit(view);

    expect(view.getByText('Enter the 6-digit code from the email')).toBeTruthy();
    expect(verifyEmail).not.toHaveBeenCalled();
  });

  it('checks the code for that email, then calls the account ready', async () => {
    const { view, verifyEmail } = await renderVerify();
    await typeCode(view, '123456');

    await submit(view);

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Account created successfully', undefined)
    );
    expect(verifyEmail).toHaveBeenCalledWith('ana@example.com', '123456');
    expect(uploadAvatar).not.toHaveBeenCalled();
  });

  it('uploads the photo picked at sign-up once there is a session for it', async () => {
    withParams({ email: 'ana@example.com', avatarUri: 'file://me.png', avatarType: 'image/png' });
    const { view } = await renderVerify();
    await typeCode(view, '123456');

    await submit(view);

    await waitFor(() =>
      expect(uploadAvatar).toHaveBeenCalledWith('user-1', 'file://me.png', 'image/png')
    );
  });

  it('still finishes when the photo upload fails, and says where to add it', async () => {
    withParams({ email: 'ana@example.com', avatarUri: 'file://me.png', avatarType: 'image/png' });
    jest.mocked(uploadAvatar).mockRejectedValueOnce(new Error('upload failed'));
    const { view } = await renderVerify();
    await typeCode(view, '123456');

    await submit(view);

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Account created successfully',
        "We couldn't upload your photo - you can add it in Settings."
      )
    );
  });

  it('explains a wrong or expired code', async () => {
    const { view } = await renderVerify({
      verifyEmail: jest.fn<AuthContextType['verifyEmail']>(async () => {
        throw Object.assign(new Error('Token has expired or is invalid'), { code: 'otp_expired' });
      }),
    });
    await typeCode(view, '000000');

    await submit(view);

    expect(
      await view.findByText('That code is wrong or has expired. Check it, or send a new one.')
    ).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('holds off resending until the countdown runs out', async () => {
    const { view, resendVerification } = await renderVerify();

    expect(view.getByText(`Send a new code in ${RESEND_CODE_COOLDOWN_SECONDS}s`)).toBeTruthy();
    await fireEvent.press(view.getByTestId('verify-resend'));
    expect(resendVerification).not.toHaveBeenCalled();

    await wait(RESEND_CODE_COOLDOWN_SECONDS);

    expect(view.getByText('Send a new code')).toBeTruthy();
  });

  it('sends a new code, clears the old one, and starts the countdown again', async () => {
    const { view, resendVerification } = await renderVerify();
    await wait(RESEND_CODE_COOLDOWN_SECONDS);
    await typeCode(view, '111111');

    await fireEvent.press(view.getByTestId('verify-resend'));

    expect(await view.findByTestId('verify-code-resent')).toBeTruthy();
    expect(resendVerification).toHaveBeenCalledWith('ana@example.com');
    expect(view.getByTestId('verify-code-input').props.value).toBe('');
    expect(view.getByText(`Send a new code in ${RESEND_CODE_COOLDOWN_SECONDS}s`)).toBeTruthy();
  });

  it('lets the user try again straight away when the new code could not be sent', async () => {
    const { view } = await renderVerify({
      resendVerification: jest.fn<AuthContextType['resendVerification']>(async () => {
        throw Object.assign(new Error('rate limited'), { code: 'over_email_send_rate_limit' });
      }),
    });
    await wait(RESEND_CODE_COOLDOWN_SECONDS);

    await fireEvent.press(view.getByTestId('verify-resend'));

    expect(
      await view.findByText('Too many emails sent. Wait a moment and try again.')
    ).toBeTruthy();
    expect(view.getByText('Send a new code')).toBeTruthy();
    expect(view.queryByTestId('verify-code-resent')).toBeNull();
  });
});
