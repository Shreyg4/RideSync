import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import React from 'react';
import { router } from 'expo-router';
import WelcomeScreen from '../(authentication)/welcome';
import { anonymousAuth, renderScreen } from '@/src/test/render';

describe('WelcomeScreen', () => {
  it('routes to login', async () => {
    (router.push as jest.Mock).mockClear();
    const view = await renderScreen(<WelcomeScreen />, anonymousAuth);

    await fireEvent.press(view.getByTestId('login-button'));

    expect(router.push).toHaveBeenCalledWith('/login');
  });

  it('routes to sign up', async () => {
    (router.push as jest.Mock).mockClear();
    const view = await renderScreen(<WelcomeScreen />, anonymousAuth);

    await fireEvent.press(view.getByTestId('create-account-button'));

    expect(router.push).toHaveBeenCalledWith('/signUp');
  });

  it('names both buttons for a screen reader', async () => {
    const view = await renderScreen(<WelcomeScreen />, anonymousAuth);

    expect(view.getByLabelText('Login')).toBeTruthy();
    expect(view.getByLabelText('Create Account')).toBeTruthy();
  });
});
