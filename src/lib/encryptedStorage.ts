import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Counter, ModeOfOperation, utils } from 'aes-js';
import { Platform } from 'react-native';
import type { SessionStorage } from './createSupabaseClient';

const KEY_BYTES = 32;

const secureKeyFor = (key: string) => `${key.replace(/[^A-Za-z0-9._-]/g, '_')}-enckey`;

const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

const isSupported = Platform.OS !== 'web';

const encrypt = async (value: string) => {
  const key = await Crypto.getRandomBytesAsync(KEY_BYTES);
  const cipher = new ModeOfOperation.ctr(key, new Counter(0));
  const ciphertext = cipher.encrypt(utils.utf8.toBytes(value));
  return { key: utils.hex.fromBytes(key), ciphertext: utils.hex.fromBytes(ciphertext) };
};

const decrypt = (hexKey: string, hexCiphertext: string) => {
  const cipher = new ModeOfOperation.ctr(utils.hex.toBytes(hexKey), new Counter(0));
  return utils.utf8.fromBytes(cipher.decrypt(utils.hex.toBytes(hexCiphertext)));
};

export const encryptedStorage: SessionStorage = {
  async getItem(key) {
    const stored = await AsyncStorage.getItem(key);
    if (stored === null) return null;
    if (!isSupported) return stored;

    const hexKey = await SecureStore.getItemAsync(secureKeyFor(key), secureOptions);
    if (hexKey === null) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    try {
      return decrypt(hexKey, stored);
    } catch {
      await encryptedStorage.removeItem(key);
      return null;
    }
  },

  async setItem(key, value) {
    if (!isSupported) {
      await AsyncStorage.setItem(key, value);
      return;
    }

    const { key: hexKey, ciphertext } = await encrypt(value);
    await SecureStore.setItemAsync(secureKeyFor(key), hexKey, secureOptions);
    await AsyncStorage.setItem(key, ciphertext);
  },

  async removeItem(key) {
    await AsyncStorage.removeItem(key);
    if (isSupported) await SecureStore.deleteItemAsync(secureKeyFor(key), secureOptions);
  },
};
