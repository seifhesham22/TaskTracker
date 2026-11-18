import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { REGISTER_MUTATION } from '../src/api/auth';
import { getSession, setSession } from '../src/auth/session';
import {
  EMAIL_INVALID,
  EMAIL_REQUIRED,
  EMAIL_TAKEN,
  NETWORK_FAILED,
  PASSWORD_REQUIRED,
  REGISTER_FAILED,
} from '../src/domain/authErrors';
import { API_URL, USER_ID, gqlError, mockFetch } from '../test-utils/fakeBackend';
import { PASSWORD, renderApp } from '../test-utils/renderApp';
import { resetSecureStore, setItemAsync } from '../test-utils/secureStoreMock';

jest.mock('expo-secure-store', () => require('../test-utils/secureStoreMock'));

const NEW_EMAIL = 'new.member@local.test';
const registered = (email = NEW_EMAIL) => ({ body: { data: { register: { id: USER_ID, email } } } });

const sentBody = (fetchMock: jest.Mock, call = 0) =>
  JSON.parse((fetchMock.mock.calls[call][1] as RequestInit).body as string) as {
    query: string;
    variables: Record<string, unknown>;
  };

async function openRegistration() {
  const router = await renderApp('/register');
  await screen.findByText('Create your account');
  return router;
}

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

describe('Registration screen', () => {
  it('renders the design: title, both fields, password toggle and the link to log in', async () => {
    const fetchMock = mockFetch();
    await openRegistration();

    expect(screen.getByText('TaskTracker')).toBeOnTheScreen();
    expect(screen.getByText('Keep your team’s work moving, together.')).toBeOnTheScreen();
    expect(screen.getByText('All fields are required.')).toBeOnTheScreen();
    expect(screen.getByText('Email')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('you@example.com')).toBeOnTheScreen();
    expect(screen.getByText('Password')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Enter your password')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Show password' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeOnTheScreen();

    const email = screen.getByTestId('email-input');
    expect(email.props.keyboardType).toBe('email-address');
    expect(email.props.autoCapitalize).toBe('none');
    const password = screen.getByTestId('password-input');
    expect(password.props.secureTextEntry).toBe(true);
    expect(password.props.autoComplete).toBe('new-password');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires an email and a password before sending anything', async () => {
    const fetchMock = mockFetch();
    await openRegistration();

    await fireEvent.press(screen.getByTestId('submit-button'));

    expect(screen.getByTestId('email-error')).toHaveTextContent(EMAIL_REQUIRED);
    expect(screen.getByTestId('password-error')).toHaveTextContent(PASSWORD_REQUIRED);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clears a field’s error once the field is edited', async () => {
    mockFetch();
    await openRegistration();
    await fireEvent.press(screen.getByTestId('submit-button'));

    await fireEvent.changeText(screen.getByTestId('email-input'), 'a');

    expect(screen.queryByTestId('email-error')).not.toBeOnTheScreen();
    expect(screen.getByTestId('password-error')).toBeOnTheScreen();
  });

  it.each(['alex@', 'alex', 'alex@example', 'al ex@example.com'])('rejects the invalid email “%s”', async (email) => {
    const fetchMock = mockFetch();
    await openRegistration();

    await fillAndSubmit(email, PASSWORD);

    expect(screen.getByTestId('email-error')).toHaveTextContent(EMAIL_INVALID);
    expect(screen.queryByTestId('password-error')).not.toBeOnTheScreen();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls the register mutation with exactly the backend’s fields and shows the confirmation', async () => {
    const fetchMock = mockFetch(registered());
    await openRegistration();

    await fillAndSubmit(`  ${NEW_EMAIL}  `, PASSWORD);

    expect(await screen.findByText('Account created')).toBeOnTheScreen();
    expect(screen.getByText('You’re ready to get started.')).toBeOnTheScreen();
    expect(
      screen.getByText('Your TaskTracker account has been created. Log in to access your projects.'),
    ).toBeOnTheScreen();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/graphql`);
    const body = sentBody(fetchMock);
    expect(body.query).toBe(REGISTER_MUTATION);
    expect(body.variables).toEqual({ input: { email: NEW_EMAIL, password: PASSWORD } });
    // Registering doesn't sign in: the backend returns no token, and nothing is stored.
    expect(getSession()).toBeNull();
    expect(setItemAsync).not.toHaveBeenCalled();
  });

  it('goes to the login screen after registering, with the new email filled in', async () => {
    mockFetch(registered());
    const router = await openRegistration();
    await fillAndSubmit(NEW_EMAIL, PASSWORD);

    await fireEvent.press(await screen.findByRole('button', { name: 'Continue to log in' }));

    await waitFor(() => expect(router).toHavePathname('/login'));
    expect(screen.getByText('Welcome back')).toBeOnTheScreen();
    expect(screen.getByTestId('email-input').props.value).toBe(NEW_EMAIL);
    expect(screen.getByTestId('password-input').props.value).toBe('');
  });

  it('shows the design’s message under Email for an email that is already registered, and stays', async () => {
    mockFetch({ body: gqlError('BAD_USER_INPUT', `An account with the email '${NEW_EMAIL}' already exists.`) });
    const router = await openRegistration();

    await fillAndSubmit(NEW_EMAIL, PASSWORD);

    expect(await screen.findByTestId('email-error')).toHaveTextContent(EMAIL_TAKEN);
    expect(router).toHavePathname('/register');
    expect(screen.queryByText('Account created')).not.toBeOnTheScreen();
    expect(screen.getByTestId('email-input').props.value).toBe(NEW_EMAIL);
  });

  it('shows the backend’s password rules under Password when it refuses the password', async () => {
    const rules = 'Passwords must be at least 10 characters. Passwords must have at least one uppercase (\'A\'-\'Z\').';
    mockFetch({ body: gqlError('BAD_USER_INPUT', rules) });
    const router = await openRegistration();

    await fillAndSubmit(NEW_EMAIL, 'short');

    expect(await screen.findByTestId('password-error')).toHaveTextContent(rules);
    expect(screen.queryByTestId('email-error')).not.toBeOnTheScreen();
    expect(router).toHavePathname('/register');
  });

  it('shows the email error when the backend finds the address invalid', async () => {
    mockFetch({ body: gqlError('BAD_USER_INPUT', `'a@b.c' is not a valid email address.`) });
    await openRegistration();

    await fillAndSubmit('a@b.c', PASSWORD);

    expect(await screen.findByTestId('email-error')).toHaveTextContent(EMAIL_INVALID);
  });

  it.each([
    ['the server can’t be reached', 'network-error' as const, NETWORK_FAILED],
    ['the server fails', { status: 500, body: { errors: [{ message: 'Unexpected Execution Error' }] } }, REGISTER_FAILED],
  ])('keeps every value and does not go to login when %s', async (_, response, message) => {
    mockFetch(response);
    const router = await openRegistration();

    await fillAndSubmit(NEW_EMAIL, PASSWORD);

    expect(await screen.findByTestId('form-error')).toHaveTextContent(message);
    expect(router).toHavePathname('/register');
    expect(screen.queryByText('Account created')).not.toBeOnTheScreen();
    expect(screen.getByTestId('email-input').props.value).toBe(NEW_EMAIL);
    expect(screen.getByTestId('password-input').props.value).toBe(PASSWORD);
  });

  it('shows “Creating account…”, locks the form and sends only one request however often it is tapped', async () => {
    let answer!: (value: unknown) => void;
    const fetchMock = jest.fn(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await openRegistration();

    await fillAndSubmit(NEW_EMAIL, PASSWORD);
    await fireEvent.press(screen.getByTestId('submit-button'));
    await fireEvent(screen.getByTestId('password-input'), 'submitEditing');

    expect(screen.getByText('Creating account…')).toBeOnTheScreen();
    expect(screen.getByTestId('submit-button')).toBeDisabled();
    expect(screen.getByTestId('email-input').props.editable).toBe(false);
    expect(screen.getByTestId('password-input').props.editable).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    answer({ ok: true, status: 200, text: async () => JSON.stringify(registered().body) });
    expect(await screen.findByText('Account created')).toBeOnTheScreen();
  });

  it('shows the password only while asked to, and keeps what was typed', async () => {
    await openRegistration();
    await fireEvent.changeText(screen.getByTestId('password-input'), PASSWORD);

    await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByTestId('password-input').props.secureTextEntry).toBe(false);
    expect(screen.getByTestId('password-input').props.value).toBe(PASSWORD);

    await fireEvent.press(screen.getByRole('button', { name: 'Hide password' }));
    expect(screen.getByTestId('password-input').props.secureTextEntry).toBe(true);
  });

  it('never writes the password to the console, even when registration fails', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => jest.spyOn(console, m));
    mockFetch({ body: gqlError('BAD_USER_INPUT', 'Passwords must have at least one digit (\'0\'-\'9\').') }, 'network-error');
    await openRegistration();

    await fillAndSubmit(NEW_EMAIL, PASSWORD);
    await screen.findByTestId('password-error');
    await fireEvent.press(screen.getByTestId('submit-button'));
    await screen.findByTestId('form-error');

    for (const spy of spies) {
      for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain(PASSWORD);
      spy.mockRestore();
    }
  });

  it('goes to the login screen from “Log in”', async () => {
    const router = await openRegistration();

    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(router).toHavePathname('/login'));
    expect(screen.getByText('Welcome back')).toBeOnTheScreen();
  });
});
