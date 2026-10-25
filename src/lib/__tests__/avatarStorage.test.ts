import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals';
import { avatarObjectPath, uploadAvatarFile, removeAvatarFile, avatarUrl } from '../avatarStorage';
import { mockBucket } from '@/src/test/supabase';

const NOW = new Date(1767225600000);

const realFetch = global.fetch;
const buffer = new ArrayBuffer(8);
const uri = 'file://photo.png';
let fetchMock: jest.Mock;
const targetPath = 'abc-123/1767225600000.png';

describe('avatarObjectPath', () => {
  it(`puts the avatar file in the user's own folder so storage RLS allows the upload`, () => {
    expect(avatarObjectPath('abc-123', 'image/png', NOW)).toBe('abc-123/1767225600000.png');
  });

  it('names the avatar file with the extension from its mime type', () => {
    expect(avatarObjectPath('u', 'image/jpeg', NOW)).toBe('u/1767225600000.jpeg');
  });

  it('falls back to jpg when the picker gives no mime type', () => {
    expect(avatarObjectPath('u', undefined, NOW)).toBe('u/1767225600000.jpg');
  });

  it('gives every new avatar file a new name so the old photo is never served from cache', () => {
    const later = new Date(NOW.getTime() + 1);
    expect(avatarObjectPath('u', 'image/png', NOW)).not.toBe(
      avatarObjectPath('u', 'image/png', later)
    );
  });
});

describe('uploadAvatarFile', () => {
  beforeEach(() => {
    fetchMock = jest.fn(async () => ({
      arrayBuffer: async () => buffer,
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it(`reads the avatar file from the picker's local uri`, async () => {
    await uploadAvatarFile(targetPath, uri, 'image/png');
    expect(fetchMock).toHaveBeenCalledWith(uri);
  });

  it('uploads the fetched bytes to the path', async () => {
    await uploadAvatarFile(targetPath, uri, 'image/png');
    expect(mockBucket('avatars').upload).toHaveBeenCalledWith(targetPath, buffer, {
      contentType: 'image/png',
    });
  });

  it('defaults to jpeg if mime type is not specified', async () => {
    await uploadAvatarFile(targetPath, uri, undefined);
    expect(mockBucket('avatars').upload).toHaveBeenCalledWith(targetPath, buffer, {
      contentType: 'image/jpeg',
    });
  });

  it('throws the storage error when the avatar file upload fails', async () => {
    const someError = new Error('Upload failed');

    mockBucket('avatars').upload.mockResolvedValueOnce({
      data: null,
      error: someError,
    } as never);

    await expect(uploadAvatarFile(targetPath, uri, undefined)).rejects.toBe(someError);
  });

  it('uploads nothing when the avatar file cannot be read', async () => {
    const readError = new Error('Network request failed');
    fetchMock.mockRejectedValueOnce(readError as never);

    await expect(uploadAvatarFile(targetPath, uri, 'image/png')).rejects.toBe(readError);
    expect(mockBucket('avatars').upload).not.toHaveBeenCalled();
  });
});

describe('removeAvatarFile', () => {
  it('deletes only the given avatar file from storage', async () => {
    await removeAvatarFile(targetPath);
    expect(mockBucket('avatars').remove).toHaveBeenCalledWith([targetPath]);
    expect(mockBucket('avatars').remove).toHaveBeenCalledTimes(1);
  });

  it('throws the storage error when the avatar file cannot be deleted', async () => {
    const someError = new Error('Deletion failed');

    mockBucket('avatars').remove.mockResolvedValueOnce({
      data: null,
      error: someError,
    } as never);

    await expect(removeAvatarFile(targetPath)).rejects.toBe(someError);
  });
});

describe('avatarUrl', () => {
  it('turns a stored avatar path into a public avatar URL', () => {
    expect(avatarUrl(targetPath)).toBe(
      `https://test.supabase.co/storage/v1/object/public/avatars/${targetPath}`
    );
  });

  it('returns null if path is null, undefined, or empty', () => {
    expect(avatarUrl(null)).toBe(null);
    expect(avatarUrl(undefined)).toBe(null);
    expect(avatarUrl('')).toBe(null);
  });
});
