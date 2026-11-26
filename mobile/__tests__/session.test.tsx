import { router as navigation } from 'expo-router';
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { LOGOUT_MUTATION, ME_QUERY } from '../src/api/auth';
import { getSession, setSession } from '../src/auth/session';
import { SESSION_KEY } from '../src/auth/sessionStorage';
import { LOGOUT_FAILED, SESSION_EXPIRED } from '../src/domain/authErrors';
import {
  ACCESS_TOKEN,
  API_URL,
  BOARD_ID,
  PROJECT_ID,
  PROJECTS,
  USER_ID,
  gqlError,
  mockFetch,
  projectsResponse,
} from '../test-utils/fakeBackend';
import {
  EMAIL,
  PASSWORD,
  loginPayload,
  logoutResponse,
  meResponse,
  renderApp,
  storedSession,
} from '../test-utils/renderApp';
import { deleteItemAsync, resetSecureStore, storedValue } from '../test-utils/secureStoreMock';

jest.mock('expo-secure-store', () => require('../test-utils/secureStoreMock'));

const NOT_AUTHENTICATED = () => ({
  body: gqlError('AUTH_NOT_AUTHENTICATED', 'The current user is not authorized to access this resource.'),
});

type Sent = { query: string; variables?: Record<string, unknown> };
const sent = (fetchMock: jest.Mock, call: number): Sent =>
  JSON.parse((fetchMock.mock.calls[call][1] as RequestInit).body as string);
const authorization = (fetchMock: jest.Mock, call: number) =>
  ((fetchMock.mock.calls[call][1] as RequestInit).headers as Headers).get('Authorization');

const projectsWithDescription = () =>
  projectsResponse([
    PROJECTS[0],
    { ...PROJECTS[1], description: 'Your team’s boards and tasks, in one place.' },
  ]);

/** Opens the app with a session already in the secure store, as after a restart. */
async function reopenSignedIn(initialUrl = '/') {
  resetSecureStore(storedSession());
  const fetchMock = mockFetch(meResponse(), projectsWithDescription());
  const router = await renderApp(initialUrl);
  await screen.findByText('Your projects');
  return { router, fetchMock };
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  resetSecureStore();
  setSession(null);
});

/** The design's “Your session has expired”, then Log in opens the form, which still says why. */
async function expectSessionExpiredScreen() {
  expect(await screen.findByRole('header', { name: 'Your session has expired' })).toBeOnTheScreen();
  expect(screen.getByText('Log in again to continue.')).toBeOnTheScreen();
  expect(
    screen.getByText('Private project content is hidden until your session and membership are verified.'),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('session-expired-login'));
  expect(screen.getByText('Welcome back')).toBeOnTheScreen();
  expect(screen.getByTestId('form-error')).toHaveTextContent(SESSION_EXPIRED);
}

describe('Restoring the session when the app is reopened', () => {
  it('restores a valid session after the backend confirms the token, and shows the user’s projects', async () => {
    const { router, fetchMock } = await reopenSignedIn();

    expect(router).toHavePathname('/');
    expect(sent(fetchMock, 0).query).toBe(ME_QUERY);
    expect(authorization(fetchMock, 0)).toBe(`Bearer ${ACCESS_TOKEN}`);
    expect(getSession()?.user).toEqual({ id: USER_ID, email: EMAIL });
    expect(sent(fetchMock, 1).variables).toEqual({ userId: USER_ID });
    expect(authorization(fetchMock, 1)).toBe(`Bearer ${ACCESS_TOKEN}`);
  });

  it('drops an expired session without asking the server, and asks the user to log in again', async () => {
    resetSecureStore(storedSession({ expiresAt: '2020-01-01T00:00:00.000Z' }));
    const fetchMock = mockFetch();
    const router = await renderApp('/');

    await expectSessionExpiredScreen();
    expect(router).toHavePathname('/login');
    expect(storedValue(SESSION_KEY)).toBeUndefined();
    expect(getSession()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('drops a session whose token the backend no longer accepts (revoked or invalid)', async () => {
    resetSecureStore(storedSession());
    mockFetch(NOT_AUTHENTICATED());
    const router = await renderApp('/');

    await expectSessionExpiredScreen();
    expect(router).toHavePathname('/login');
    expect(storedValue(SESSION_KEY)).toBeUndefined();
    expect(getSession()).toBeNull();
  });

  it('removes a stored value that isn’t a session', async () => {
    resetSecureStore({ [SESSION_KEY]: '{"accessToken": 42' });
    mockFetch();
    await renderApp('/');

    expect(await screen.findByText('Welcome back')).toBeOnTheScreen();
    expect(screen.queryByTestId('form-error')).not.toBeOnTheScreen();
    expect(storedValue(SESSION_KEY)).toBeUndefined();
  });

  it('keeps an unexpired session when the server can’t be reached to check it', async () => {
    resetSecureStore(storedSession());
    mockFetch('network-error', 'network-error');
    const router = await renderApp('/');

    expect(await screen.findByText('Your projects')).toBeOnTheScreen();
    expect(router).toHavePathname('/');
    expect(await screen.findByText('Couldn’t load your projects')).toBeOnTheScreen();
    expect(storedValue(SESSION_KEY)).toBeDefined();
  });

  it('signs out when the token stops working while the app is in use', async () => {
    resetSecureStore(storedSession());
    mockFetch(meResponse(), NOT_AUTHENTICATED());
    const router = await renderApp('/');

    await expectSessionExpiredScreen();
    expect(router).toHavePathname('/login');
    expect(storedValue(SESSION_KEY)).toBeUndefined();
    expect(getSession()).toBeNull();
  });
});

describe('Protected screens', () => {
  it.each(['/', '/boards', `/boards/${BOARD_ID}`])('sends a signed-out user from %s to the login screen', async (url) => {
    const fetchMock = mockFetch();
    const router = await renderApp(url);

    expect(await screen.findByText('Welcome back')).toBeOnTheScreen();
    expect(router).toHavePathname('/login');
    expect(screen.queryByText('Board screen')).not.toBeOnTheScreen();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a signed-in user away from login and registration to the projects', async () => {
    await reopenSignedIn('/register');
    expect(screen.queryByText('Create your account')).not.toBeOnTheScreen();
  });
});

describe('Your projects', () => {
  it('lists the signed-in user’s projects as in the design', async () => {
    await reopenSignedIn();

    expect(screen.getByText('Only projects you can access')).toBeOnTheScreen();
    expect(screen.getByText('Choose a project from your list.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeOnTheScreen();
    const card = await screen.findByTestId(`project-${PROJECT_ID}`);
    expect(within(card).getByText('Test Project')).toBeOnTheScreen();
    expect(within(card).getByText('Your team’s boards and tasks, in one place.')).toBeOnTheScreen();
    expect(within(card).getByRole('button', { name: 'Open Test Project' })).toBeOnTheScreen();
    expect(screen.getByText('Other Project')).toBeOnTheScreen();
  });

  it('opens a project’s boards once the backend confirms membership', async () => {
    const { router, fetchMock } = await reopenSignedIn();
    mockFetch(projectsWithDescription());

    await fireEvent.press(await screen.findByRole('button', { name: 'Open Test Project' }));

    await waitFor(() => expect(router).toHavePathname(`/projects/${PROJECT_ID}`));
    expect(await screen.findByText('Test Board')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Test Project' })).toBeOnTheScreen();
    expect(screen.getByText('Member access · permitted content')).toBeOnTheScreen();
    expect(screen.queryByText('Other Board')).not.toBeOnTheScreen();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('Logging out', () => {
  it('ends the session on the server, clears the device and the app, and confirms it', async () => {
    const { router } = await reopenSignedIn();
    const fetchMock = mockFetch(logoutResponse());

    await fireEvent.press(screen.getByRole('button', { name: 'Log out' }));

    expect(await screen.findByText('You’re logged out')).toBeOnTheScreen();
    expect(screen.getByText('Session ended')).toBeOnTheScreen();
    expect(screen.getByText('Your session has ended. Log in again whenever you’re ready.')).toBeOnTheScreen();
    expect(router).toHavePathname('/login');

    expect(sent(fetchMock, 0).query).toBe(LOGOUT_MUTATION);
    expect(authorization(fetchMock, 0)).toBe(`Bearer ${ACCESS_TOKEN}`);
    expect(deleteItemAsync).toHaveBeenCalledWith(SESSION_KEY, expect.anything());
    expect(storedValue(SESSION_KEY)).toBeUndefined();
    expect(getSession()).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Back to log in' }));
    expect(screen.getByText('Welcome back')).toBeOnTheScreen();
    expect(screen.queryByTestId('form-error')).not.toBeOnTheScreen();
  });

  it('shows “Logging out…” while the server is asked, and ignores more taps', async () => {
    await reopenSignedIn();
    let answer!: (value: unknown) => void;
    const fetchMock = jest.fn(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fireEvent.press(screen.getByRole('button', { name: 'Log out' }));
    await fireEvent.press(screen.getByTestId('logout-button'));

    expect(screen.getByText('Logging out…')).toBeOnTheScreen();
    expect(screen.getByText('Ending your session…')).toBeOnTheScreen();
    expect(screen.getByTestId('logout-button')).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => answer({ ok: true, status: 200, text: async () => JSON.stringify(logoutResponse().body) }));
    expect(await screen.findByText('You’re logged out')).toBeOnTheScreen();
  });

  it('keeps protected screens closed after logout', async () => {
    const { router } = await reopenSignedIn();
    const fetchMock = mockFetch(logoutResponse());
    await fireEvent.press(screen.getByRole('button', { name: 'Log out' }));
    await screen.findByText('You’re logged out');

    // The projects screen is gone from the history, so Back can't return to it, and no request
    // is sent with the old token. (Opening a protected link while signed out, as after a restart
    // with nothing stored, is covered under “Protected screens”.)
    expect(router).toHavePathname('/login');
    expect(navigation.canGoBack()).toBe(false);
    expect(screen.queryByText('Your projects')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Open Test Project' })).not.toBeOnTheScreen();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(storedValue(SESSION_KEY)).toBeUndefined();
  });

  it('treats a token the server already refuses as logged out', async () => {
    await reopenSignedIn();
    mockFetch(NOT_AUTHENTICATED());

    await fireEvent.press(screen.getByRole('button', { name: 'Log out' }));

    expect(await screen.findByText('You’re logged out')).toBeOnTheScreen();
    expect(getSession()).toBeNull();
  });

  it('removes the stored session even if the server can’t confirm logout, and offers to try again', async () => {
    const { router } = await reopenSignedIn();
    mockFetch('network-error');

    await fireEvent.press(screen.getByRole('button', { name: 'Log out' }));

    expect(await screen.findByTestId('logout-error')).toHaveTextContent(LOGOUT_FAILED);
    expect(router).toHavePathname('/');
    // Nothing is left on the device, so a restart would be signed out.
    expect(storedValue(SESSION_KEY)).toBeUndefined();

    const fetchMock = mockFetch(logoutResponse());
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('You’re logged out')).toBeOnTheScreen();
    expect(authorization(fetchMock, 0)).toBe(`Bearer ${ACCESS_TOKEN}`);
    expect(getSession()).toBeNull();
  });

  it('lets the next user log in after a logout, with their own session', async () => {
    await reopenSignedIn();
    mockFetch(logoutResponse());
    await fireEvent.press(screen.getByRole('button', { name: 'Log out' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Back to log in' }));

    const fetchMock = mockFetch(loginPayload({ accessToken: 'second-token' }), projectsResponse());
    await fireEvent.changeText(screen.getByTestId('email-input'), EMAIL);
    await fireEvent.changeText(screen.getByTestId('password-input'), PASSWORD);
    await fireEvent.press(screen.getByTestId('submit-button'));

    expect(await screen.findByText('Your projects')).toBeOnTheScreen();
    expect(authorization(fetchMock, 1)).toBe('Bearer second-token');
    expect(JSON.parse(storedValue(SESSION_KEY)!).accessToken).toBe('second-token');
  });
});
