import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../api';
import type { AuthService, AuthUser, LoginInput, LoginResult } from '../api/services/AuthService';
import { AuthContext, type AuthContextValue } from './authContextDef';
import { defaultTokenStorage, type ITokenStorage } from './TokenStorage';

export type { AuthContextValue } from './authContextDef';

export interface AuthProviderProps {
  readonly children: ReactNode;
  readonly authService?: AuthService;
  readonly tokenStorage?: ITokenStorage;
  readonly initialUser?: AuthUser | null;
}

export function AuthProvider({
  children,
  authService = api.auth,
  tokenStorage = defaultTokenStorage,
  initialUser = null,
}: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(() => tokenStorage.getToken());
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    return Boolean(tokenStorage.getToken() && !initialUser);
  });

  useEffect(() => {
    let isCancelled = false;

    async function verifySession() {
      const storedToken = tokenStorage.getToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      if (user) {
        setIsLoading(false);
        return;
      }

      try {
        const currentUser = await authService.me();
        if (isCancelled) return;
        if (currentUser) {
          setUser(currentUser);
        } else {
          tokenStorage.clearToken();
          setToken(null);
          setUser(null);
        }
      } catch {
        if (!isCancelled) {
          tokenStorage.clearToken();
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    verifySession();

    return () => {
      isCancelled = true;
    };
  }, [authService, tokenStorage, user]);

  const login = useCallback(
    async (input: LoginInput): Promise<LoginResult> => {
      const result = await authService.login(input);
      tokenStorage.setToken(result.accessToken);
      setToken(result.accessToken);
      setUser(result.user);
      return result;
    },
    [authService, tokenStorage],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authService.logout();
    } finally {
      tokenStorage.clearToken();
      setToken(null);
      setUser(null);
    }
  }, [authService, tokenStorage]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      isLoading,
      login,
      logout,
    }),
    [user, token, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
