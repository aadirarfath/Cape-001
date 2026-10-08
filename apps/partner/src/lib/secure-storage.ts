import * as SecureStore from 'expo-secure-store';

// Supabase Auth storage backed by expo-secure-store (Android Keystore / iOS Keychain).
//
// A Supabase session is a few kilobytes of JSON, and some platforms reject secure-store values
// above about 2 KB, so each value is split into chunks: "<key>.n" holds the chunk count and
// "<key>.0", "<key>.1", ... hold the parts. Keys may only use letters, digits, ".", "-" and "_".

const CHUNK_SIZE = 1800;

const countKey = (key: string) => `${key}.n`;
const chunkKey = (key: string, index: number) => `${key}.${index}`;

async function chunkCount(key: string): Promise<number> {
  const value = await SecureStore.getItemAsync(countKey(key));
  const count = value === null ? 0 : Number.parseInt(value, 10);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

async function deleteChunks(key: string, from: number, to: number): Promise<void> {
  for (let i = from; i < to; i++) {
    await SecureStore.deleteItemAsync(chunkKey(key, i));
  }
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = await chunkCount(key);
    if (count === 0) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(chunkKey(key, i));
      // A missing chunk means a write was interrupted; treat it as signed out.
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const previous = await chunkCount(key);
    const parts = value.match(new RegExp(`[\\s\\S]{1,${CHUNK_SIZE}}`, 'g')) ?? [''];
    for (let i = 0; i < parts.length; i++) {
      await SecureStore.setItemAsync(chunkKey(key, i), parts[i] ?? '');
    }
    await SecureStore.setItemAsync(countKey(key), String(parts.length));
    await deleteChunks(key, parts.length, previous);
  },

  async removeItem(key: string): Promise<void> {
    const count = await chunkCount(key);
    await SecureStore.deleteItemAsync(countKey(key));
    await deleteChunks(key, 0, count);
  },
};
