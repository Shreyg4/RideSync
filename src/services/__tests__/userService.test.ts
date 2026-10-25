// userService is the only code that talks to the users table. The username check is the one
// call that swallows its error, so it is pinned to report it and answer "don't know".

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { setErrorReporter } from '@/src/lib/logger';
import { getUserAvatarPath, isUsernameAvailable, setUserAvatarPath } from '../userService';
import { mockRpc, mockSupabase, mockTable } from '@/src/test/supabase';

const queryError = { code: 'PGRST301', message: 'JWT expired' };

let reporter: jest.Mock;

beforeEach(() => {
  reporter = jest.fn();
  setErrorReporter(reporter);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  setErrorReporter(null);
});

describe('isUsernameAvailable', () => {
  it.each([true, false])('returns %s as the database answered', async (available) => {
    mockRpc('username_available', { data: available });

    await expect(isUsernameAvailable('ana_lee')).resolves.toBe(available);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('username_available', { candidate: 'ana_lee' });
  });

  it('reports a failed check and returns null, so the form claims neither free nor taken', async () => {
    mockRpc('username_available', { error: queryError });

    await expect(isUsernameAvailable('ana_lee')).resolves.toBeNull();
    expect(reporter).toHaveBeenCalledWith(queryError, { scope: 'userService.isUsernameAvailable' });
  });
});

describe('getUserAvatarPath', () => {
  it('returns null for a signed-out user without querying', async () => {
    await expect(getUserAvatarPath(undefined)).resolves.toBeNull();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it(`reads the avatar path off that user's row`, async () => {
    mockTable('users').__setResult({ data: { avatar_path: 'user-1/1767225600000.png' } });

    await expect(getUserAvatarPath('user-1')).resolves.toBe('user-1/1767225600000.png');
    expect(mockTable('users').select).toHaveBeenCalledWith('avatar_path');
    expect(mockTable('users').eq).toHaveBeenCalledWith('id', 'user-1');
    expect(mockTable('users').single).toHaveBeenCalled();
  });

  it('returns null when the user has no avatar', async () => {
    mockTable('users').__setResult({ data: { avatar_path: null } });
    await expect(getUserAvatarPath('user-1')).resolves.toBeNull();
  });

  it('reports and rethrows a failed read', async () => {
    mockTable('users').__setResult({ error: queryError });

    await expect(getUserAvatarPath('user-1')).rejects.toBe(queryError);
    expect(reporter).toHaveBeenCalledWith(queryError, { scope: 'userService.getUserAvatarPath' });
  });
});

describe('setUserAvatarPath', () => {
  it(`saves the path on that user's row only`, async () => {
    await expect(setUserAvatarPath('user-1', 'user-1/2.png')).resolves.toBeUndefined();

    expect(mockTable('users').update).toHaveBeenCalledWith({ avatar_path: 'user-1/2.png' });
    expect(mockTable('users').eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('throws the update error', async () => {
    mockTable('users').__setResult({ error: queryError });
    await expect(setUserAvatarPath('user-1', 'user-1/2.png')).rejects.toBe(queryError);
  });
});
