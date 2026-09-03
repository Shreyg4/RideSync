import { describe, expect, it } from '@jest/globals';
import { avatarObjectPath } from '../avatarStorage';

const NOW = new Date(1767225600000);

describe('avatarObjectPath', () => {
  it('prefixes the userId, which is what the storage RLS policies check', () => {
    expect(avatarObjectPath('abc-123', 'image/png', NOW)).toBe('abc-123/1767225600000.png');
  });

  it('derives the extension from the mime type', () => {
    expect(avatarObjectPath('u', 'image/jpeg', NOW)).toBe('u/1767225600000.jpeg');
  });

  it('falls back to jpg when the picker gives no mime type', () => {
    expect(avatarObjectPath('u', undefined, NOW)).toBe('u/1767225600000.jpg');
  });

  it('is unique per upload, so no cache can serve the previous photo', () => {
    const later = new Date(NOW.getTime() + 1);
    expect(avatarObjectPath('u', 'image/png', NOW)).not.toBe(
      avatarObjectPath('u', 'image/png', later)
    );
  });
});
