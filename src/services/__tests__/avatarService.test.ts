// Changing an avatar touches the bucket and the users row, so these check the order that keeps
// the user's row pointing at a real file whichever step fails.

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { removeAvatarFile, uploadAvatarFile } from '@/src/lib/avatarStorage';
import { setErrorReporter } from '@/src/lib/logger';
import { uploadAvatar } from '../avatarService';
import { getUserAvatarPath, setUserAvatarPath } from '../userService';

// Keeps the real path builder, so the path under test is the one the app would upload to
jest.mock('@/src/lib/avatarStorage', () => ({
  avatarObjectPath:
    jest.requireActual<typeof import('@/src/lib/avatarStorage')>('@/src/lib/avatarStorage')
      .avatarObjectPath,
  avatarUrl: jest.fn(),
  uploadAvatarFile: jest.fn(async () => {}),
  removeAvatarFile: jest.fn(async () => {}),
}));

jest.mock('../userService', () => ({
  getUserAvatarPath: jest.fn(async () => null),
  setUserAvatarPath: jest.fn(async () => {}),
}));

const USER = 'user-1';
const URI = 'file://photo.png';
const NOW = new Date(1767225600000);
const NEW_PATH = 'user-1/1767225600000.png';
const OLD_PATH = 'user-1/1767000000000.jpg';

const upload = () => uploadAvatar(USER, URI, 'image/png', NOW);
const order = (fn: unknown) => (fn as jest.Mock).mock.invocationCallOrder[0];

let reporter: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  reporter = jest.fn();
  setErrorReporter(reporter);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  setErrorReporter(null);
});

describe('uploadAvatar', () => {
  it(`uploads to a new path in the user's folder, saves it on the user, and returns it`, async () => {
    await expect(upload()).resolves.toBe(NEW_PATH);

    expect(uploadAvatarFile).toHaveBeenCalledWith(NEW_PATH, URI, 'image/png');
    expect(setUserAvatarPath).toHaveBeenCalledWith(USER, NEW_PATH);
    expect(order(uploadAvatarFile)).toBeLessThan(order(setUserAvatarPath));
  });

  it('removes the previous avatar only after the new one is saved', async () => {
    jest.mocked(getUserAvatarPath).mockResolvedValueOnce(OLD_PATH);

    await upload();

    expect(removeAvatarFile).toHaveBeenCalledWith(OLD_PATH);
    expect(order(setUserAvatarPath)).toBeLessThan(order(removeAvatarFile));
  });

  it('removes nothing for a first avatar', async () => {
    await upload();
    expect(removeAvatarFile).not.toHaveBeenCalled();
  });

  it('never removes the file it just uploaded', async () => {
    jest.mocked(getUserAvatarPath).mockResolvedValueOnce(NEW_PATH);

    await upload();

    expect(removeAvatarFile).not.toHaveBeenCalled();
  });

  it('still uploads when the previous path cannot be read', async () => {
    jest.mocked(getUserAvatarPath).mockRejectedValueOnce(new Error('read failed'));

    await expect(upload()).resolves.toBe(NEW_PATH);
    expect(uploadAvatarFile).toHaveBeenCalled();
    expect(setUserAvatarPath).toHaveBeenCalledWith(USER, NEW_PATH);
    expect(removeAvatarFile).not.toHaveBeenCalled();
  });

  it('leaves the user row alone when the upload fails', async () => {
    const uploadError = new Error('upload failed');
    jest.mocked(getUserAvatarPath).mockResolvedValueOnce(OLD_PATH);
    jest.mocked(uploadAvatarFile).mockRejectedValueOnce(uploadError);

    await expect(upload()).rejects.toBe(uploadError);
    expect(setUserAvatarPath).not.toHaveBeenCalled();
    expect(removeAvatarFile).not.toHaveBeenCalled();
  });

  it('keeps the old avatar when saving the new path fails', async () => {
    const saveError = { code: '42501', message: 'permission denied' };
    jest.mocked(getUserAvatarPath).mockResolvedValueOnce(OLD_PATH);
    jest.mocked(setUserAvatarPath).mockRejectedValueOnce(saveError);

    await expect(upload()).rejects.toBe(saveError);
    expect(removeAvatarFile).not.toHaveBeenCalled();
  });

  it('reports a failed removal and still returns the new path', async () => {
    const removeError = new Error('remove failed');
    jest.mocked(getUserAvatarPath).mockResolvedValueOnce(OLD_PATH);
    jest.mocked(removeAvatarFile).mockRejectedValueOnce(removeError);

    await expect(upload()).resolves.toBe(NEW_PATH);
    expect(reporter).toHaveBeenCalledWith(removeError, {
      scope: 'avatarService.uploadAvatar.removePrevious',
      previousPath: OLD_PATH,
    });
  });
});
