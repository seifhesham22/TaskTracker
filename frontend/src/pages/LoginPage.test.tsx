import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, AuthError } from '../api';
import { AuthProvider } from '../auth/AuthContext';
import { defaultTokenStorage } from '../auth/TokenStorage';
import { routes } from '../app/routes';

function renderLoginPage(initialEntry = '/login') {
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    defaultTokenStorage.clearToken();
  });

  it('renders login form elements according to design', () => {
    renderLoginPage();

    expect(screen.getByRole('heading', { level: 1, name: /log in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^show password$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^log in$/i })).toBeInTheDocument();
    expect(screen.getByText(/don't have an account\?/i)).toBeInTheDocument();
  });

  it('validates required fields on empty submit', async () => {
    renderLoginPage();

    fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('validates invalid email format', async () => {
    renderLoginPage();

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'Password123' } });
    fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));

    expect(await screen.findByText('Please enter a valid email address')).toBeInTheDocument();
  });

  it('toggles password visibility between password and text type', () => {
    renderLoginPage();

    const passwordInput = screen.getByLabelText(/^password$/i);
    const toggleButton = screen.getByRole('button', { name: /^show password$/i });

    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /^hide password$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^hide password$/i }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('displays generic error banner on invalid credentials', async () => {
    vi.spyOn(api.auth, 'login').mockRejectedValueOnce(
      new AuthError('Invalid email or password.', 'INVALID_CREDENTIALS'),
    );

    renderLoginPage();

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'wrongPassword' } });
    fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
  });

  it('shows loading state while login is in progress', async () => {
    let resolveLogin: (val: { accessToken: string; tokenType: string; user: { id: string; email: string } }) => void = () => {};
    const loginPromise = new Promise<{ accessToken: string; tokenType: string; user: { id: string; email: string } }>((resolve) => {
      resolveLogin = resolve;
    });

    vi.spyOn(api.auth, 'login').mockReturnValueOnce(loginPromise);

    renderLoginPage();

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'Dev@123456' } });
    fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));

    expect(screen.getByRole('button', { name: /logging in…/i })).toBeDisabled();
    expect(screen.getByLabelText(/^email$/i)).toBeDisabled();
    expect(screen.getByLabelText(/^password$/i)).toBeDisabled();

    resolveLogin({
      accessToken: 'valid-token',
      tokenType: 'Bearer',
      user: { id: 'u-1', email: 'user@example.com' },
    });

    await waitFor(() => {
      expect(defaultTokenStorage.getToken()).toBe('valid-token');
    });
  });

  it('successfully logs in and navigates to available projects', async () => {
    vi.spyOn(api.auth, 'login').mockResolvedValueOnce({
      accessToken: 'valid-token',
      tokenType: 'Bearer',
      user: { id: 'u-1', email: 'user1@local.test' },
    });
    vi.spyOn(api.auth, 'getProjects').mockResolvedValueOnce([
      {
        id: 'p-1',
        key: 'TES',
        name: 'Test Project',
        role: 'OWNER',
        boards: [{ id: 'b-1', name: 'Test Board' }],
      },
    ]);

    renderLoginPage();

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'user1@local.test' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'Dev@123456' } });
    fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));

    expect(await screen.findByRole('heading', { level: 1, name: /available projects/i })).toBeInTheDocument();
    expect(await screen.findByText('Test Project')).toBeInTheDocument();
    expect(await screen.findByText('Test Board →')).toBeInTheDocument();
  });
});
