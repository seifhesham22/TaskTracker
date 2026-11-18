import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { loginRequest, logoutRequest, meRequest, type Credentials } from '../api/auth';
import { NOT_AUTHENTICATED, hasErrorCode } from '../api/graphql';
import { getSession, isExpired, setSession, setUnauthenticatedHandler, type Session, type SessionUser } from './session';
import { secureSessionStorage, type SessionStorage } from './sessionStorage';

export type AuthStatus = 'restoring' | 'signedOut' | 'signedIn';

/** Why the user is signed out, so the login screen can say so. */
export type SignOutNotice = 'loggedOut' | 'expired' | null;

export interface AuthContextValue {
  status: AuthStatus;
  user: SessionUser | null;
  notice: SignOutNotice;
  clearNotice(): void;
  /** Signs in and keeps the session in secure storage. Rejects with the backend's error. */
  login(credentials: Credentials): Promise<void>;
  /**
   * Ends the session on the server and on the device. The stored session is deleted before the
   * server is asked, so nothing is left on the device if the request fails. On failure it rejects
   * and the user stays signed in for this run of the app only, so logout can be tried again.
   */
  logout(): Promise<void>;
}

interface AuthState {
  status: AuthStatus;
  user: SessionUser | null;
  notice: SignOutNotice;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function quietly(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch {
    // Secure storage failed. Nothing more can be done, and the error may describe the stored value.
  }
}

export function AuthProvider({
  storage = secureSessionStorage,
  children,
}: {
  storage?: SessionStorage;
  children: ReactNode;
}) {
  const [state, setState] = useState<AuthState>({ status: 'restoring', user: null, notice: null });

  const signIn = useCallback((session: Session) => {
    setSession(session);
    setState({ status: 'signedIn', user: session.user, notice: null });
  }, []);

  const signOut = useCallback((notice: SignOutNotice) => {
    setSession(null);
    setState({ status: 'signedOut', user: null, notice });
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      let stored: Session | null = null;
      try {
        stored = await storage.load();
      } catch {
        stored = null;
      }
      if (!active) return;
      if (!stored) {
        signOut(null);
        return;
      }
      if (isExpired(stored)) {
        await quietly(() => storage.clear());
        if (active) signOut('expired');
        return;
      }

      try {
        const user = await meRequest(stored.accessToken);
        if (active) signIn({ ...stored, user });
      } catch (error) {
        if (!active) return;
        if (hasErrorCode(error, NOT_AUTHENTICATED) || hasErrorCode(error, 'NOT_FOUND')) {
          // Revoked, signed with another key, or the account is gone.
          await quietly(() => storage.clear());
          if (active) signOut('expired');
        } else {
          // The server couldn't be asked. The token hasn't expired, so keep the user signed in;
          // the first request the backend refuses signs them out.
          signIn(stored);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [storage, signIn, signOut]);

  useEffect(() => {
    setUnauthenticatedHandler(() => {
      void quietly(() => storage.clear());
      signOut('expired');
    });
    return () => setUnauthenticatedHandler(null);
  }, [storage, signOut]);

  const login = useCallback(
    async (credentials: Credentials) => {
      const session = await loginRequest(credentials);
      // If the secure store fails, the user is still signed in, just not after a restart.
      await quietly(() => storage.save(session));
      signIn(session);
    },
    [storage, signIn],
  );

  const logout = useCallback(async () => {
    const session = getSession();
    await quietly(() => storage.clear());
    if (session) {
      try {
        await logoutRequest(session.accessToken);
      } catch (error) {
        // AUTH_NOT_AUTHENTICATED: the token already doesn't work, so the session is over anyway.
        if (!hasErrorCode(error, NOT_AUTHENTICATED)) throw error;
      }
    }
    signOut('loggedOut');
  }, [storage, signOut]);

  const clearNotice = useCallback(() => setState((s) => (s.notice ? { ...s, notice: null } : s)), []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, clearNotice, login, logout }),
    [state, clearNotice, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
