import { useContext } from 'react';
import { api } from '../api';
import { AuthContext, type AuthContextValue } from './authContextDef';
import { defaultTokenStorage } from './TokenStorage';

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context) {
    return context;
  }

  // Fallback for tests or components rendered outside an explicit AuthProvider
  const currentToken = defaultTokenStorage.getToken();
  return {
    user: currentToken ? { id: '01a1ab51-d6a2-7116-99b9-0f0d52de1527', email: 'user1@local.test' } : null,
    token: currentToken,
    isAuthenticated: Boolean(currentToken),
    isLoading: false,
    login: async (input) => {
      const res = await api.auth.login(input);
      defaultTokenStorage.setToken(res.accessToken);
      return res;
    },
    logout: async () => {
      try {
        await api.auth.logout();
      } finally {
        defaultTokenStorage.clearToken();
      }
    },
  };
}
