import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Platform-agnostic key-value storage.
 * Uses localStorage on web and AsyncStorage on native.
 */
export const Storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return AsyncStorage.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    await AsyncStorage.removeItem(key);
  },

  async multiRemove(keys: string[]): Promise<void> {
    if (Platform.OS === 'web') {
      keys.forEach(key => localStorage.removeItem(key));
      return;
    }
    await AsyncStorage.multiRemove(keys);
  }
};
