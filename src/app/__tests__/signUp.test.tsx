// Sign-up is the one form that talks to the server while the user is still typing, so these pin
// when the username check runs, what it shows, and how it gates the submit.

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import type { User } from '@supabase/supabase-js';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { Alert } from 'react-native';
import SignUpScreen from '../(authentication)/signUp';
import type { AuthContextType } from '@/src/context/AuthProvider';
import { uploadAvatar } from '@/src/services/avatarService';
import { mockAlert } from '@/src/test/alert';
import { anonymousAuth, renderScreen } from '@/src/test/render';
import { mockRpc, mockSupabase } from '@/src/test/supabase';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('@/src/services/avatarService', () => ({
  uploadAvatar: jest.fn(),
  avatarUrl: jest.fn(),
}));

type View = Awaited<ReturnType<typeof renderScreen>>;

const user = { id: 'user-1' } as User;

// Keyed by each field's accessibility label, which TextBox takes from its placeholder
const FORM = {
  'First name': 'Ana',
  'Last name': 'Lee',
  Username: 'ana_lee',
  Email: 'ana@example.com',
  Password: 'hunter2222',
  'Re-enter password': 'hunter2222',
};

const renderSignUp = async (signUp = jest.fn<AuthContextType['signUp']>(async () => user)) => {
  const view = await renderScreen(<SignUpScreen />, { ...anonymousAuth, signUp });
  return { view, signUp };
};

const fill = async (view: View, overrides: Partial<typeof FORM> = {}) => {
  for (const [label, value] of Object.entries({ ...FORM, ...overrides })) {
    await fireEvent.changeText(view.getByLabelText(label), value);
  }
};

// The username check waits for a 400 ms pause in typing before it asks the server
const pauseTyping = (ms = 400) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

const submit = (view: View) => fireEvent.press(view.getByLabelText('Create Account'));

const usernameChecks = () =>
  mockSupabase.rpc.mock.calls.filter(([fn]) => fn === 'username_available');

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockAlert();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockRpc('username_available', { data: true });
  jest.mocked(uploadAvatar).mockResolvedValue('user-1/1767225600000.png');
  jest
    .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
    .mockResolvedValue({ granted: true } as never);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://me.png', mimeType: 'image/png' }],
  } as never);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('SignUpScreen', () => {
  it('does not call signUp while the form is invalid', async () => {
    const { view, signUp } = await renderSignUp();

    await submit(view);

    expect(view.getAllByText('Required')).toHaveLength(2);
    expect(view.getByText('At least 5 characters')).toBeTruthy();
    expect(view.getByText('Enter a valid email')).toBeTruthy();
    expect(view.getByText('Password is not long enough')).toBeTruthy();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('checks the username only once typing pauses for 400 ms, and only the latest value', async () => {
    const { view } = await renderSignUp();
    const username = view.getByLabelText('Username');

    await fireEvent.changeText(username, 'ana_l');
    await pauseTyping(200);
    await fireEvent.changeText(username, 'ana_le');
    await pauseTyping(399);
    expect(usernameChecks()).toHaveLength(0);

    await pauseTyping(1);

    expect(usernameChecks()).toEqual([['username_available', { candidate: 'ana_le' }]]);
  });

  it.each(['ana', 'ana lee!'])(
    'never checks %p, which cannot be a valid username',
    async (name) => {
      const { view } = await renderSignUp();

      await fireEvent.changeText(view.getByLabelText('Username'), name);
      await pauseTyping();

      expect(usernameChecks()).toHaveLength(0);
      expect(view.queryByText('Checking…')).toBeNull();
    }
  );

  it.each([
    ['free', true, 'Available'],
    ['taken', false, 'Already taken'],
  ])('shows Checking…, then that a %s username is %s', async (_, available, label) => {
    mockRpc('username_available', { data: available });
    const { view } = await renderSignUp();

    await fireEvent.changeText(view.getByLabelText('Username'), 'ana_lee');
    expect(view.getByText('Checking…')).toBeTruthy();

    await pauseTyping();

    expect(view.getByText(label)).toBeTruthy();
    expect(view.queryByText('Checking…')).toBeNull();
  });

  it('shows neither answer when the check itself fails', async () => {
    mockRpc('username_available', { error: { code: 'PGRST301' } });
    const { view } = await renderSignUp();

    await fireEvent.changeText(view.getByLabelText('Username'), 'ana_lee');
    await pauseTyping();

    expect(view.queryByText('Checking…')).toBeNull();
    expect(view.queryByText('Available')).toBeNull();
    expect(view.queryByText('Already taken')).toBeNull();
  });

  it('blocks submit while the username is taken', async () => {
    mockRpc('username_available', { data: false });
    const { view, signUp } = await renderSignUp();
    await fill(view);
    await pauseTyping();

    await submit(view);

    expect(view.getByText('Username already taken')).toBeTruthy();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('blocks submit while the username is still being checked', async () => {
    const { view, signUp } = await renderSignUp();
    await fill(view);

    await submit(view);

    expect(view.getByTestId('signup-form-error')).toHaveTextContent(
      'Still checking that username - one moment.'
    );
    expect(signUp).not.toHaveBeenCalled();
  });

  it('creates the account from the tidied form', async () => {
    const { view, signUp } = await renderSignUp();
    await fill(view, { 'First name': '  Ana ', Email: ' Ana@Example.com ' });
    await pauseTyping();

    await submit(view);

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Account created successfully', undefined)
    );
    expect(signUp).toHaveBeenCalledWith('Ana', 'Lee', 'ana_lee', 'ana@example.com', 'hunter2222');
    expect(uploadAvatar).not.toHaveBeenCalled();
  });

  it('still creates the account when the photo upload fails, and says where to add it', async () => {
    jest.mocked(uploadAvatar).mockRejectedValueOnce(new Error('upload failed'));
    const { view, signUp } = await renderSignUp();
    await fireEvent.press(view.getByLabelText('Profile picture'));
    await fill(view);
    await pauseTyping();

    await submit(view);

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Account created successfully',
        "We couldn't upload your photo - you can add it in Settings."
      )
    );
    expect(signUp).toHaveBeenCalled();
    expect(uploadAvatar).toHaveBeenCalledWith('user-1', 'file://me.png', 'image/png');
  });

  it('marks the username taken when sign-up fails because someone just took it', async () => {
    const { view } = await renderSignUp(
      jest.fn<AuthContextType['signUp']>(async () => {
        throw Object.assign(new Error('Database error saving new user'), {
          code: 'unexpected_failure',
        });
      })
    );
    await fill(view);
    await pauseTyping();
    mockRpc('username_available', { data: false });

    await submit(view);

    expect(await view.findByText('Username already taken')).toBeTruthy();
    expect(view.queryByTestId('signup-form-error')).toBeNull();
  });

  it('shows the friendly error when sign-up fails for any other reason', async () => {
    const { view } = await renderSignUp(
      jest.fn<AuthContextType['signUp']>(async () => {
        throw Object.assign(new Error('rate limited'), { code: 'over_request_rate_limit' });
      })
    );
    await fill(view);
    await pauseTyping();

    await submit(view);

    await waitFor(() =>
      expect(view.getByTestId('signup-form-error')).toHaveTextContent(
        'Too many attempts. Wait a moment and try again.'
      )
    );
  });

  it('explains how to turn photo access back on when it is denied', async () => {
    jest
      .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
      .mockResolvedValueOnce({ granted: false } as never);
    const { view } = await renderSignUp();

    await fireEvent.press(view.getByLabelText('Profile picture'));

    expect(
      await view.findByText('Photo access is off. Enable it in Settings to pick a picture.')
    ).toBeTruthy();
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });
});
