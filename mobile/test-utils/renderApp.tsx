import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import NotFoundScreen from '../src/app/+not-found';
import RootLayout from '../src/app/_layout';
import BoardsScreen from '../src/app/boards/index';
import ProjectsScreen from '../src/app/index';
import LoginScreen from '../src/app/login';
import RegisterScreen from '../src/app/register';
import type { Session } from '../src/auth/session';
import { SESSION_KEY } from '../src/auth/sessionStorage';
import { ACCESS_TOKEN, FAR_FUTURE, USER_ID } from './fakeBackend';

export const EMAIL = 'admin@local.test';
// A made-up value for tests only, never a real account's password.
export const PASSWORD = 'Test@Pass12345';

export const loginPayload = (overrides: Partial<{ accessToken: string; expiresAt: string }> = {}) => ({
  body: {
    data: {
      login: {
        accessToken: ACCESS_TOKEN,
        tokenType: 'Bearer',
        expiresAt: FAR_FUTURE,
        user: { id: USER_ID, email: EMAIL },
        ...overrides,
      },
    },
  },
});

export const meResponse = () => ({ body: { data: { me: { id: USER_ID, email: EMAIL } } } });
export const logoutResponse = () => ({ body: { data: { logout: true } } });

export const storedSession = (overrides: Partial<Session> = {}): Record<string, string> => ({
  [SESSION_KEY]: JSON.stringify({
    accessToken: ACCESS_TOKEN,
    expiresAt: FAR_FUTURE,
    user: { id: USER_ID, email: EMAIL },
    ...overrides,
  }),
});

/** The whole app as it runs: the real root layout with its auth guard, and the real screens. */
export async function renderApp(initialUrl = '/') {
  return renderRouter(
    {
      _layout: RootLayout,
      index: ProjectsScreen,
      login: LoginScreen,
      register: RegisterScreen,
      'boards/index': BoardsScreen,
      'boards/[boardId]': () => <Text>Board screen</Text>,
      '+not-found': NotFoundScreen,
    },
    { initialUrl },
  );
}
