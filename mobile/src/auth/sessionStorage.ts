import * as SecureStore from 'expo-secure-store';

import type { Session } from './session';

/**
 * Where the session survives an app restart. The default keeps it in the device's secure store
 * (iOS Keychain, Android Keystore-encrypted storage). It holds the access token, its expiry and the
 * user's ID and email, never the password.
 */
export interface SessionStorage {
  load(): Promise<Session | null>;
  save(session: Session): Promise<void>;
  clear(): Promise<void>;
}

export const SESSION_KEY = 'tasktracker.session';

const OPTIONS: SecureStore.SecureStoreOptions = {
  // Readable only while the device is unlocked, and never restored onto another device from a backup.
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const user = v.user as Record<string, unknown> | undefined;
  return (
    typeof v.accessToken === 'string' &&
    v.accessToken.length > 0 &&
    typeof v.expiresAt === 'string' &&
    !!user &&
    typeof user.id === 'string' &&
    typeof user.email === 'string'
  );
}

export const secureSessionStorage: SessionStorage = {
  async load() {
    const raw = await SecureStore.getItemAsync(SESSION_KEY, OPTIONS);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isSession(parsed)) return parsed;
    } catch {
      // Unreadable: fall through and remove it.
    }
    await SecureStore.deleteItemAsync(SESSION_KEY, OPTIONS);
    return null;
  },

  async save(session) {
    const { accessToken, expiresAt, user } = session;
    await SecureStore.setItemAsync(
      SESSION_KEY,
      JSON.stringify({ accessToken, expiresAt, user: { id: user.id, email: user.email } }),
      OPTIONS,
    );
  },

  async clear() {
    await SecureStore.deleteItemAsync(SESSION_KEY, OPTIONS);
  },
};
