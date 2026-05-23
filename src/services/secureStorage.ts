// src/services/secureStorage.ts
// Stockage sécurisé pour les tokens et secrets (Keychain iOS / EncryptedSharedPreferences Android).
// Fallback sur AsyncStorage pour web et pour données non-sensibles.
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const useSecureStore = Platform.OS !== 'web';

/**
 * Stockage sécurisé pour tokens / refresh tokens / clés de chiffrement.
 * Sur iOS/Android, utilise le Keychain/Keystore natif.
 * Sur web, fallback AsyncStorage (pas sécurisé mais pas critique en dev).
 */
export const secureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    if (useSecureStore) {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
    } else {
      await AsyncStorage.setItem(key, value);
    }
  },

  async getItem(key: string): Promise<string | null> {
    if (useSecureStore) {
      return SecureStore.getItemAsync(key);
    }
    return AsyncStorage.getItem(key);
  },

  async removeItem(key: string): Promise<void> {
    if (useSecureStore) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
  },

  async multiRemove(keys: string[]): Promise<void> {
    await Promise.all(keys.map(k => this.removeItem(k)));
  },
};

/**
 * Génère un deviceId unique persistant.
 * Stocké dans le storage sécurisé pour éviter qu'une autre app puisse le lire.
 */
const DEVICE_ID_KEY = 'mpaye_device_id';

export async function getOrCreateDeviceId(): Promise<string> {
  let id = await secureStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    // Génère un UUID v4 (compatible avec expo-crypto si dispo, sinon fallback)
    id = generateUUID();
    await secureStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function generateUUID(): string {
  // UUID v4 RFC4122 compliant
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
