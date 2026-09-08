/**
 * @file encryptedStorage.ts
 * @description An encrypted replacement for AsyncStorage that supabase-js uses to persist the login session, 
 * so that the JWT and refresh token never sit in plaintext on the device
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Counter, ModeOfOperation, utils } from 'aes-js';
import { Platform } from 'react-native';
import type { SessionStorage } from './createSupabaseClient';

const KEY_BYTES = 32;

// SecureStore only accepts keys matching [A-Za-z0-9._-]
const secureKeyFor = (key: string) => `${key.replace(/[^A-Za-z0-9._-]/g, '_')}-enckey`;

const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

// If platform is web, default to plain AsyncStorage since encryption is not useful when both the key and ciphertext are stored in the same place
const isSupported = Platform.OS !== 'web';

const encrypt = async (value: string) => {
  const key = await Crypto.getRandomBytesAsync(KEY_BYTES);
  const cipher = new ModeOfOperation.ctr(key, new Counter(0)); // Counter can start at 0 because key is never reused
  const ciphertext = cipher.encrypt(utils.utf8.toBytes(value));
  return { key: utils.hex.fromBytes(key), ciphertext: utils.hex.fromBytes(ciphertext) };
};

const decrypt = (hexKey: string, hexCiphertext: string) => {
  const cipher = new ModeOfOperation.ctr(utils.hex.toBytes(hexKey), new Counter(0));
  return utils.utf8.fromBytes(cipher.decrypt(utils.hex.toBytes(hexCiphertext)));
};

export const encryptedStorage: SessionStorage = {
  // Generate a fresh random 32-byte key and encrypts the value under it
  async setItem(key, value) {
    if (!isSupported) {
      await AsyncStorage.setItem(key, value);
      return;
    }

    // Stash key in keychain and ciphertext in AsyncStorage
    const { key: hexKey, ciphertext } = await encrypt(value);
    await SecureStore.setItemAsync(secureKeyFor(key), hexKey, secureOptions);
    await AsyncStorage.setItem(key, ciphertext);
  },

  // Fetch both key and ciphertext and decrypt
  async getItem(key) {
    const stored = await AsyncStorage.getItem(key);
    if (stored === null) return null;
    if (!isSupported) return stored;

    const hexKey = await SecureStore.getItemAsync(secureKeyFor(key), secureOptions);
    if (hexKey === null) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    // Decrypt the value or remove both halves if key is wrong or corrupt
    try {
      return decrypt(hexKey, stored);
    } catch {
      await encryptedStorage.removeItem(key);
      return null;
    }
  },

  // Deletes both items so logout leaves nothing behind
  async removeItem(key) {
    await AsyncStorage.removeItem(key);
    if (isSupported) await SecureStore.deleteItemAsync(secureKeyFor(key), secureOptions);
  },
};
