import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import SettingsScreen from '../(tabs)/settings';
import { lastAlert, mockAlert, pressAlertButton } from '@/src/test/alert';
import { renderScreen, signedInAuth } from '@/src/test/render';
import { mockTable } from '@/src/test/supabase';

describe('SettingsScreen', () => {
  it('renders the avatar once the path resolves', async () => {
    mockTable('users').__setResult({ data: { avatar_path: 'user-1/1.jpg' }, error: null });
    const view = await renderScreen(<SettingsScreen />, signedInAuth());

    await waitFor(() => expect(view.getByTestId('settings-avatar')).toBeTruthy());
    expect(view.queryByText('Retry')).toBeNull();
  });

  it('surfaces a failed avatar fetch with a retry instead of showing nothing', async () => {
    mockTable('users').__setResult({ data: null, error: { code: 'PGRST116' } });
    const view = await renderScreen(<SettingsScreen />, signedInAuth());

    await waitFor(() => expect(view.getByText('We could not find that.')).toBeTruthy());
    expect(view.getByText('Retry')).toBeTruthy();
  });

  it('gives the sign-out failure a message and a way back', async () => {
    mockTable('users').__setResult({ data: { avatar_path: null }, error: null });
    const signOut = jest.fn(async () => {
      throw Object.assign(new Error('network down'), { code: 'over_request_rate_limit' });
    });
    const view = await renderScreen(<SettingsScreen />, signedInAuth({ signOut }));

    await fireEvent.press(view.getByTestId('log-out-button'));

    await waitFor(() =>
      expect(view.getByText('Too many attempts. Wait a moment and try again.')).toBeTruthy()
    );
    expect(view.getByText('Try again')).toBeTruthy();
    expect(view.queryByText('network down')).toBeNull();
  });

  it('signs out without an error when the service succeeds', async () => {
    mockTable('users').__setResult({ data: { avatar_path: null }, error: null });
    const signOut = jest.fn(async () => {});
    const view = await renderScreen(<SettingsScreen />, signedInAuth({ signOut }));

    await fireEvent.press(view.getByTestId('log-out-button'));

    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(view.queryByText('Try again')).toBeNull();
  });

  it('asks before deleting the account, and deletes it once confirmed', async () => {
    mockAlert();
    mockTable('users').__setResult({ data: { avatar_path: null }, error: null });
    const deleteAccount = jest.fn(async () => {});
    const view = await renderScreen(<SettingsScreen />, signedInAuth({ deleteAccount }));

    await fireEvent.press(view.getByTestId('delete-account-button'));

    expect(lastAlert().title).toBe('Delete account?');
    expect(deleteAccount).not.toHaveBeenCalled();

    await pressAlertButton('Delete');

    await waitFor(() => expect(deleteAccount).toHaveBeenCalledTimes(1));
  });

  it('deletes nothing when the user cancels', async () => {
    mockAlert();
    mockTable('users').__setResult({ data: { avatar_path: null }, error: null });
    const deleteAccount = jest.fn(async () => {});
    const view = await renderScreen(<SettingsScreen />, signedInAuth({ deleteAccount }));

    await fireEvent.press(view.getByTestId('delete-account-button'));
    await pressAlertButton('Cancel');

    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('shows why deleting failed and lets the user try again', async () => {
    mockAlert();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockTable('users').__setResult({ data: { avatar_path: null }, error: null });
    const deleteAccount = jest.fn(async () => {
      throw Object.assign(new Error('rate limited'), { code: 'over_request_rate_limit' });
    });
    const view = await renderScreen(<SettingsScreen />, signedInAuth({ deleteAccount }));

    await fireEvent.press(view.getByTestId('delete-account-button'));
    await pressAlertButton('Delete');

    expect(await view.findByText('Too many attempts. Wait a moment and try again.')).toBeTruthy();
    expect(view.getByText('Try again')).toBeTruthy();
    expect(view.getByTestId('delete-account-button')).toBeEnabled();
  });
});
