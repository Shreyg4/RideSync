import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import {
  tripImageObjectPath,
  uploadTripImageFile,
  removeTripImageFile,
  tripImageUrl,
} from '../tripImageStorage';
import { mockBucket } from '@/src/test/supabase';

const NOW = new Date(1767225600000);

const realFetch = global.fetch;
const buffer = new ArrayBuffer(8);
const uri = 'file://photo.png';
let fetchMock: jest.Mock;
const targetPath = 'abc-123/1767225600000.png';

describe('tripImageObjectPath', () => {
  it('Prefixes the userId, which is what the upload trip image RLS policy checks', () => {
    expect(tripImageObjectPath('abc-123', 'image/png', NOW)).toBe('abc-123/1767225600000.png');
  });

  it('derives the extension from the mime type', () => {
    expect(tripImageObjectPath('u', 'image/jpeg', NOW)).toBe('u/1767225600000.jpeg');
  });

  it('falls back to jpg when picker gives no mime type', () => {
    expect(tripImageObjectPath('u', undefined, NOW)).toBe('u/1767225600000.jpg');
  });

  it('is unique per upload, so no cache can serve the previous photo', () => {
    const later = new Date(NOW.getTime() + 1);
    expect(tripImageObjectPath('u', 'image/png', NOW)).not.toBe(
      tripImageObjectPath('u', 'image/png', later)
    );
  });
});

describe('uploadTripImageFile', () => {
  beforeEach(() => {
    fetchMock = jest.fn(async () => ({
      arrayBuffer: async () => buffer,
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('calls with the passed uri', async () => {
    await uploadTripImageFile(targetPath, uri, 'image/png');
    expect(fetchMock).toHaveBeenCalledWith(uri);
  });

  it('uploads the fetched bytes to the path', async () => {
    await uploadTripImageFile(targetPath, uri, 'image/png');
    expect(mockBucket('trip-images').upload).toHaveBeenCalledWith(targetPath, buffer, {
      contentType: 'image/png',
    });
  });

  it('defaults to jpeg if mime type is not specified', async () => {
    await uploadTripImageFile(targetPath, uri, undefined);
    expect(mockBucket('trip-images').upload).toHaveBeenCalledWith(targetPath, buffer, {
      contentType: 'image/jpeg',
    });
  });

  it('should reject with an error when upload fails', async () => {
    const someError = new Error('Upload failed');

    mockBucket('trip-images').upload.mockResolvedValueOnce({
      data: null,
      error: someError,
    } as never);

    await expect(uploadTripImageFile(targetPath, uri, undefined)).rejects.toBe(someError);
  });

  it('should reject without uploading when the image cannot be read', async () => {
    const readError = new Error('Network request failed');
    fetchMock.mockRejectedValueOnce(readError as never);

    await expect(uploadTripImageFile(targetPath, uri, 'image/png')).rejects.toBe(readError);
    expect(mockBucket('trip-images').upload).not.toHaveBeenCalled();
  });
});

describe('removeTripImageFile', () => {
  it('should remove selected image file', async () => {
    await removeTripImageFile(targetPath);
    expect(mockBucket('trip-images').remove).toHaveBeenCalledWith([targetPath]);
    expect(mockBucket('trip-images').remove).toHaveBeenCalledTimes(1);
  });

  it('should reject with an error when remove fails', async () => {
    const someError = new Error('Deletion failed');

    mockBucket('trip-images').remove.mockResolvedValueOnce({
      data: null,
      error: someError,
    } as never);

    await expect(removeTripImageFile(targetPath)).rejects.toBe(someError);
  });
});

describe('tripImageUrl', () => {
  it('returns the public URL for a path', () => {
    expect(tripImageUrl(targetPath)).toBe(
      `https://test.supabase.co/storage/v1/object/public/trip-images/${targetPath}`
    );
  });

  it('returns null if path is null, undefined, or empty', () => {
    expect(tripImageUrl(null)).toBe(null);
    expect(tripImageUrl(undefined)).toBe(null);
    expect(tripImageUrl('')).toBe(null);
  });
});
