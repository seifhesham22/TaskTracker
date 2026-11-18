import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { LOGIN_MUTATION } from '../src/api/auth';
import { getSession, setSession } from '../src/auth/session';
import { SESSION_KEY } from '../src/auth/sessionStorage';
import {
  EMAIL_INVALID,
  EMAIL_REQUIRED,
  INVALID_CREDENTIALS,
  LOGIN_FAILED,
  PASSWORD_REQUIRED,
} from '../src/domain/authErrors';
import { ACCESS_TOKEN, API_URL, FAR_FUTURE, PROJECTS, USER_ID, gqlError, mockFetch, projectsResponse } from '../test-utils/fakeBackend';
import { EMAIL, PASSWORD, loginPayload, renderApp } from '../test-utils/renderApp';
import { resetSecureStore, setItemAsync, storedValue } from '../test-utils/secureStoreMock';

jest.mock('expo-secure-store', () => require('../test-utils/secureStoreMock'));

type Sent = { query: string; variables: Record<string, unknown> };
const sent = (fetchMock: jest.Mock, call: number): Sent =>
  JSON.parse((fetchMock.mock.calls[call][1] as RequestInit).body as string);
const headerOf = (fetchMock: jest.Mock, call: number, name: string) =>
  ((fetchMock.mock.calls[call][1] as RequestInit).headers as Headers).get(name);

async function fillAndSubmit(email: string, password: string) {
  await fireEvent.changeText(screen.getByTestId('email-input'), email);
  await fireEvent.changeText(screen.getByTestId('password-input'), password);
  await fireEvent.press(screen.getByTestId('submit-button'));
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  resetSecureStore();
  setSession(null);
});

describe('Login screen', () => {
  it('opens on the login screen when nobody is signed in, as in the design', async () => {
    const fetchMock = mockFetch();
    const router = await renderApp('/');

    expect(await screen.findByText('Welcome back')).toBeOnTheScreen();
    expect(router).toHavePathname('/login');
    expect(screen.getByText('Log in to access your projects.')).toBeOnTheScreen();
    expect(screen.getByText('Email')).toBeOnTheScreen();
    expect(screen.getByText('Password')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('you@example.com')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Enter your password')).toBeOnTheScreen();
    expect(screen.getByText('Show password')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeOnTheScreen();
    expect(screen.getByText('New to TaskTracker?', { exact: false })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Create an account' })).toBeOnTheScreen();
    expect(screen.getByTestId('email-input').props.keyboardType).toBe('email-address');
    expect(screen.getByTestId('password-input').props.secureTextEntry).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires both fields and sends nothing', async () => {
    const fetchMock = mockFetch();
    await renderApp('/login');
    await screen.findByText('Welcome back');

    await fireEvent.press(screen.getByTestId('submit-button'));

    expect(screen.getByTestId('email-error')).toHaveTextContent(EMAIL_REQUIRED);
    expect(screen.getByTestId('password-error')).toHaveTextContent(PASSWORD_REQUIRED);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid email address and sends nothing', async () => {
    const fetchMock = mockFetch();
    await renderApp('/login');
    await screen.findByText('Welcome back');

    await fillAndSubmit('alex@', PASSWORD);

    expect(screen.getByTestId('email-error')).toHaveTextContent(EMAIL_INVALID);
    expect(screen.queryByTestId('password-error')).not.toBeOnTheScreen();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('logs in with the real login mutation, keeps the session and opens the user’s projects', async () => {
    const fetchMock = mockFetch(loginPayload(), projectsResponse());
    const router = await renderApp('/login');
    await screen.findByText('Welcome back');

    await fillAndSubmit(`  ${EMAIL} `, PASSWORD);

    expect(await screen.findByText('Your projects')).toBeOnTheScreen();
    expect(router).toHavePathname('/');

    const login = sent(fetchMock, 0);
    expect(login.query).toBe(LOGIN_MUTATION);
    expect(login.variables).toEqual({ input: { email: EMAIL, password: PASSWORD } });
    expect(headerOf(fetchMock, 0, 'Authorization')).toBeNull();

    expect(getSession()).toEqual({ accessToken: ACCESS_TOKEN, expiresAt: FAR_FUTURE, user: { id: USER_ID, email: EMAIL } });

    // The projects are those of the user who logged in, fetched with their token.
    expect(sent(fetchMock, 1).variables).toEqual({ userId: USER_ID });
    expect(headerOf(fetchMock, 1, 'Authorization')).toBe(`Bearer ${ACCESS_TOKEN}`);
    expect(await screen.findByText(PROJECTS[1].name)).toBeOnTheScreen();
    expect(screen.getByText(PROJECTS[0].name)).toBeOnTheScreen();
  });

  it('keeps the session in the secure store, without the password', async () => {
    mockFetch(loginPayload(), projectsResponse());
    await renderApp('/login');
    await screen.findByText('Welcome back');

    await fillAndSubmit(EMAIL, PASSWORD);
    await screen.findByText('Your projects');

    expect(setItemAsync).toHaveBeenCalledTimes(1);
    const [key, value, options] = setItemAsync.mock.calls[0] as unknown as [string, string, { keychainAccessible: number }];
    expect(key).toBe(SESSION_KEY);
    expect(options.keychainAccessible).toBe(5);
    expect(JSON.parse(value)).toEqual({ accessToken: ACCESS_TOKEN, expiresAt: FAR_FUTURE, user: { id: USER_ID, email: EMAIL } });
    expect(storedValue(SESSION_KEY)).not.toContain(PASSWORD);
  });

  it('shows one generic message for wrong credentials, keeps the input and stays signed out', async () => {
    mockFetch({ body: gqlError('INVALID_CREDENTIALS', 'Invalid email or password.') });
    const router = await renderApp('/login');
    await screen.findByText('Welcome back');

    await fillAndSubmit(EMAIL, 'Wrong@Pass123');

    expect(await screen.findByTestId('form-error')).toHaveTextContent(INVALID_CREDENTIALS);
    expect(router).toHavePathname('/login');
    expect(screen.getByTestId('email-input').props.value).toBe(EMAIL);
    expect(screen.getByTestId('password-input').props.value).toBe('Wrong@Pass123');
    expect(getSession()).toBeNull();
    expect(setItemAsync).not.toHaveBeenCalled();
  });

  it('says “We couldn’t log you in” when the server can’t be reached, without clearing the input', async () => {
    mockFetch('network-error');
    await renderApp('/login');
    await screen.findByText('Welcome back');

    await fillAndSubmit(EMAIL, PASSWORD);

    expect(await screen.findByTestId('form-error')).toHaveTextContent(LOGIN_FAILED);
    expect(screen.getByTestId('email-input').props.value).toBe(EMAIL);
    expect(screen.getByTestId('password-input').props.value).toBe(PASSWORD);
  });

  it('shows “Logging in…” and ignores more taps while the request runs', async () => {
    let answer!: (value: unknown) => void;
    const fetchMock = jest.fn(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await renderApp('/login');
    await screen.findByText('Welcome back');

    await fillAndSubmit(EMAIL, PASSWORD);
    await fireEvent.press(screen.getByTestId('submit-button'));

    expect(screen.getByText('Logging in…')).toBeOnTheScreen();
    expect(screen.getByTestId('submit-button')).toBeDisabled();
    expect(screen.getByTestId('email-input').props.editable).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    mockFetch(projectsResponse());
    answer({ ok: true, status: 200, text: async () => JSON.stringify(loginPayload().body) });
    expect(await screen.findByText('Your projects')).toBeOnTheScreen();
  });

  it('shows and hides the password without changing it', async () => {
    await renderApp('/login');
    await screen.findByText('Welcome back');
    await fireEvent.changeText(screen.getByTestId('password-input'), PASSWORD);

    await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByTestId('password-input').props.secureTextEntry).toBe(false);
    expect(screen.getByTestId('password-input').props.value).toBe(PASSWORD);

    await fireEvent.press(screen.getByRole('button', { name: 'Hide password' }));
    expect(screen.getByTestId('password-input').props.secureTextEntry).toBe(true);
  });

  it('opens registration from “Create an account”', async () => {
    const router = await renderApp('/login');
    await screen.findByText('Welcome back');

    await fireEvent.press(screen.getByRole('button', { name: 'Create an account' }));

    await waitFor(() => expect(router).toHavePathname('/register'));
    expect(screen.getByText('Create your account')).toBeOnTheScreen();
  });
});
