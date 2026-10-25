// The session store has to fail closed: whenever the two halves don't line up, the session
// is dropped rather than half-trusted, and logging out leaves nothing behind.

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { encryptedStorage } from '../encryptedStorage';

// In-memory keychain. Named mock* so the hoisted jest.mock factory may close over it.
const mockKeychain = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockKeychain.set(key, value);
  }),
  getItemAsync: jest.fn(async (key: string) => mockKeychain.get(key) ?? null),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockKeychain.delete(key);
  }),
}));

// Real random bytes, so two saves really do get two different keys.
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: async (count: number) =>
    new Uint8Array(jest.requireActual<typeof import('crypto')>('crypto').randomBytes(count)),
}));

const KEY = 'sb-test-auth-token';
const SECURE_KEY = `${KEY}-enckey`;
const SESSION = JSON.stringify({
  access_token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln',
  refresh_token: 'r3fr3sh',
  user: { email: 'rider@example.com', first_name: 'Zoë' },
});

beforeEach(async () => {
  await AsyncStorage.clear();
  mockKeychain.clear();
  jest.clearAllMocks();
});

describe('encryptedStorage', () => {
  it('reads back exactly what it saved', async () => {
    await encryptedStorage.setItem(KEY, SESSION);
    await expect(encryptedStorage.getItem(KEY)).resolves.toBe(SESSION);
  });

  // Names are free text, and an emoji is a 4-byte UTF-8 sequence
  it('reads back a session whose user has an emoji in their name', async () => {
    const session = JSON.stringify({ user: { first_name: 'Zoë 🚗' } });

    await encryptedStorage.setItem(KEY, session);

    await expect(encryptedStorage.getItem(KEY)).resolves.toBe(session);
  });

  it('never writes the session to AsyncStorage in plaintext', async () => {
    await encryptedStorage.setItem(KEY, SESSION);

    const stored = await AsyncStorage.getItem(KEY);
    expect(stored).toMatch(/^[0-9a-f]+$/);
    expect(stored).not.toContain('r3fr3sh');
  });

  it('keeps the key in the keychain, readable only on this device after first unlock', async () => {
    await encryptedStorage.setItem(KEY, SESSION);

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      SECURE_KEY,
      expect.stringMatching(/^[0-9a-f]{64}$/),
      { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }
    );
    expect(await AsyncStorage.getAllKeys()).toEqual([KEY]);
  });

  it('uses a fresh key on every save, so the same session never encrypts the same way twice', async () => {
    await encryptedStorage.setItem(KEY, SESSION);
    const firstKey = mockKeychain.get(SECURE_KEY);
    const firstCiphertext = await AsyncStorage.getItem(KEY);

    await encryptedStorage.setItem(KEY, SESSION);

    expect(mockKeychain.get(SECURE_KEY)).not.toBe(firstKey);
    expect(await AsyncStorage.getItem(KEY)).not.toBe(firstCiphertext);
    await expect(encryptedStorage.getItem(KEY)).resolves.toBe(SESSION);
  });

  it('returns null when nothing has been saved, without reaching the keychain', async () => {
    await expect(encryptedStorage.getItem(KEY)).resolves.toBeNull();
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  });

  it('drops the ciphertext when its key is gone, e.g. a backup restored to a new device', async () => {
    await encryptedStorage.setItem(KEY, SESSION);
    mockKeychain.clear();

    await expect(encryptedStorage.getItem(KEY)).resolves.toBeNull();
    await expect(AsyncStorage.getItem(KEY)).resolves.toBeNull();
  });

  it('drops both halves when the ciphertext is corrupt', async () => {
    await encryptedStorage.setItem(KEY, SESSION);
    await AsyncStorage.setItem(KEY, 'zz');

    await expect(encryptedStorage.getItem(KEY)).resolves.toBeNull();
    await expect(AsyncStorage.getItem(KEY)).resolves.toBeNull();
    expect(mockKeychain.has(SECURE_KEY)).toBe(false);
  });

  it('drops both halves when the key is corrupt', async () => {
    await encryptedStorage.setItem(KEY, SESSION);
    mockKeychain.set(SECURE_KEY, 'abcd'); // 2 bytes, not a valid AES key size

    await expect(encryptedStorage.getItem(KEY)).resolves.toBeNull();
    await expect(AsyncStorage.getItem(KEY)).resolves.toBeNull();
    expect(mockKeychain.has(SECURE_KEY)).toBe(false);
  });

  it('removes both halves, so logging out leaves nothing behind', async () => {
    await encryptedStorage.setItem(KEY, SESSION);
    await encryptedStorage.removeItem(KEY);

    expect(await AsyncStorage.getAllKeys()).toEqual([]);
    expect(mockKeychain.size).toBe(0);
  });

  it('swaps characters SecureStore rejects for underscores, in the keychain key only', async () => {
    const key = 'sb:test/auth token';
    await encryptedStorage.setItem(key, SESSION);

    expect(mockKeychain.has('sb_test_auth_token-enckey')).toBe(true);
    expect(await AsyncStorage.getAllKeys()).toEqual([key]);
    await expect(encryptedStorage.getItem(key)).resolves.toBe(SESSION);
  });
});

describe('encryptedStorage on web', () => {
  let webStorage: typeof encryptedStorage;
  let webAsyncStorage: typeof AsyncStorage;
  let webSecureStore: typeof SecureStore;

  // Platform is read once at import, so load a fresh copy of the module that sees 'web'
  beforeEach(() => {
    jest.isolateModules(() => {
      jest.doMock('react-native', () => ({ Platform: { OS: 'web' } }));
      /* eslint-disable @typescript-eslint/no-require-imports */
      webStorage = require('../encryptedStorage').encryptedStorage;
      webAsyncStorage = require('@react-native-async-storage/async-storage').default;
      webSecureStore = require('expo-secure-store');
      /* eslint-enable @typescript-eslint/no-require-imports */
    });
  });

  it('stores the session as is, since a key kept beside the ciphertext would protect nothing', async () => {
    await webStorage.setItem(KEY, SESSION);

    await expect(webAsyncStorage.getItem(KEY)).resolves.toBe(SESSION);
    await expect(webStorage.getItem(KEY)).resolves.toBe(SESSION);
  });

  it('never touches SecureStore, which has no web implementation', async () => {
    await webStorage.setItem(KEY, SESSION);
    await webStorage.getItem(KEY);
    await webStorage.removeItem(KEY);

    expect(webSecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(webSecureStore.getItemAsync).not.toHaveBeenCalled();
    expect(webSecureStore.deleteItemAsync).not.toHaveBeenCalled();
    await expect(webAsyncStorage.getItem(KEY)).resolves.toBeNull();
  });
});
