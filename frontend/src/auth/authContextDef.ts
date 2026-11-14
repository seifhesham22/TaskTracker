import { createContext } from 'react';
import type { AuthUser, LoginInput, LoginResult } from '../api/services/AuthService';

export interface AuthContextValue {
  readonly user: AuthUser | null;
  readonly token: string | null;
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  readonly login: (input: LoginInput) => Promise<LoginResult>;
  readonly logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
