/**
 * In-memory stand-in for expo-secure-store, whose native module doesn't exist under Jest.
 * Use with: jest.mock('expo-secure-store', () => require('../test-utils/secureStoreMock'));
 */
const store = new Map<string, string>();

export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 5;

export const getItemAsync = jest.fn(async (key: string) => store.get(key) ?? null);
export const setItemAsync = jest.fn(async (key: string, value: string) => {
  store.set(key, value);
});
export const deleteItemAsync = jest.fn(async (key: string) => {
  store.delete(key);
});

export function resetSecureStore(entries: Record<string, string> = {}): void {
  store.clear();
  for (const [key, value] of Object.entries(entries)) store.set(key, value);
  getItemAsync.mockClear();
  setItemAsync.mockClear();
  deleteItemAsync.mockClear();
}

export function storedValue(key: string): string | undefined {
  return store.get(key);
}
