import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { api, AuthError } from '../api';
import { routes } from '../app/routes';

function renderRegister() {
  const router = createMemoryRouter(routes, { initialEntries: ['/register'] });
  return {
    router,
    ...render(<RouterProvider router={router} />),
  };
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the default registration form with all required elements', () => {
    renderRegister();

    expect(screen.getByRole('heading', { level: 1, name: /create account/i })).toBeInTheDocument();
    expect(screen.getByText('All fields are required')).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show password/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByText(/already have an account/i)).toBeInTheDocument();
  });

  it('shows required-field errors when submitting empty form', async () => {
    renderRegister();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();

    expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows invalid email error for malformed email', async () => {
    renderRegister();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/^password$/i), 'ValidPass123!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not call the API when validation fails', async () => {
    const spy = vi.spyOn(api.auth, 'register');
    renderRegister();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(spy).not.toHaveBeenCalled();
  });

  it('clears field error when the user types in the invalid field', async () => {
    renderRegister();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText('Email is required.')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/email/i), 'a');
    expect(screen.queryByText('Email is required.')).not.toBeInTheDocument();
  });

  it('shows loading state while registration is in progress and prevents duplicate submission', async () => {
    let resolveRegister!: (value: { id: string; email: string }) => void;
    vi.spyOn(api.auth, 'register').mockImplementation(
      () => new Promise((resolve) => { resolveRegister = resolve; })
    );

    renderRegister();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'ValidPass123!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    const button = screen.getByRole('button', { name: /creating account/i });
    expect(button).toBeDisabled();
    expect(screen.getByLabelText(/email/i)).toBeDisabled();
    expect(screen.getByLabelText(/^password$/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /show password/i })).toBeDisabled();

    resolveRegister({ id: 'u1', email: 'test@example.com' });
  });

  it('shows success screen after successful registration and allows navigating to login', async () => {
    vi.spyOn(api.auth, 'register').mockResolvedValue({
      id: 'u1',
      email: 'test@example.com',
    });

    const { router } = renderRegister();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'ValidPass123!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByTestId('register-success')).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /account created/i })).toBeInTheDocument();
    expect(screen.getByText(/your account has been created successfully/i)).toBeInTheDocument();

    const continueBtn = screen.getByRole('button', { name: /continue to login/i });
    expect(continueBtn).toBeInTheDocument();

    await user.click(continueBtn);
    expect(router.state.location.pathname).toBe('/login');
  });

  it('shows email-already-used error on the email field', async () => {
    vi.spyOn(api.auth, 'register').mockRejectedValue(
      new AuthError("An account with the email 'a@b.com' already exists.", 'BAD_USER_INPUT')
    );

    renderRegister();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/^password$/i), 'ValidPass123!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert', { name: /something went wrong/i })).toBeNull();
  });

  it('shows generic form error for non-email server errors', async () => {
    vi.spyOn(api.auth, 'register').mockRejectedValue(
      new AuthError('Internal server error', 'INTERNAL')
    );

    renderRegister();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'ValidPass123!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Internal server error')).toBeInTheDocument();
  });

  it('shows fallback error for unknown exceptions', async () => {
    vi.spyOn(api.auth, 'register').mockRejectedValue(new Error('Network failure'));

    renderRegister();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'ValidPass123!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
  });

  it('toggles password visibility between text and password types', async () => {
    renderRegister();
    const user = userEvent.setup();

    const passwordInput = screen.getByLabelText(/^password$/i);
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleButton = screen.getByRole('button', { name: /show password/i });
    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /hide password/i }));
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: /show password/i })).toBeInTheDocument();
  });

  it('passes trimmed email to the API', async () => {
    const spy = vi.spyOn(api.auth, 'register').mockResolvedValue({
      id: 'u1',
      email: 'test@example.com',
    });

    renderRegister();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), '  test@example.com  ');
    await user.type(screen.getByLabelText(/^password$/i), 'ValidPass123!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'ValidPass123!',
      });
    });
  });

  it('re-enables the form after a failed submission', async () => {
    vi.spyOn(api.auth, 'register').mockRejectedValue(new Error('fail'));

    renderRegister();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'ValidPass123!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create account/i })).not.toBeDisabled();
    });
    expect(screen.getByLabelText(/email/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/^password$/i)).not.toBeDisabled();
  });
});
