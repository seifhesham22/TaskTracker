import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, AuthError } from '../api';
import { AuthProvider } from '../auth/AuthContext';
import { defaultTokenStorage } from '../auth/TokenStorage';
import { routes } from '../app/routes';
import { ColumnCategory } from '../domain/models';

function renderApp(initialPath = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

describe('Auth & Protected Navigation Acceptance Tests', () => {
  beforeEach(() => {
    defaultTokenStorage.clearToken();
    vi.restoreAllMocks();
  });

  it('prevents unauthenticated user from accessing protected screen and redirects to /login', async () => {
    renderApp('/projects');

    // Should redirect to login page
    expect(await screen.findByRole('heading', { level: 1, name: /log in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
  });

  it('logs in with valid credentials and navigates to available projects', async () => {
    vi.spyOn(api.auth, 'login').mockResolvedValueOnce({
      accessToken: 'jwt-access-token-123',
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

    renderApp('/login');

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'user1@local.test' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'Dev@123456' } });
    fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));

    expect(await screen.findByRole('heading', { level: 1, name: /available projects/i })).toBeInTheDocument();
    expect(await screen.findByText('Test Project')).toBeInTheDocument();
    expect(defaultTokenStorage.getToken()).toBe('jwt-access-token-123');
  });

  it('shows generic error on invalid credentials and keeps user on login page', async () => {
    vi.spyOn(api.auth, 'login').mockRejectedValueOnce(
      new AuthError('Invalid email or password.', 'INVALID_CREDENTIALS'),
    );

    renderApp('/login');

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'unknown@local.test' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'WrongPassword' } });
    fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(screen.getByRole('heading', { level: 1, name: /log in/i })).toBeInTheDocument();
    expect(defaultTokenStorage.getToken()).toBeNull();
  });

  it('maintains authenticated state after page reload when token is stored', async () => {
    defaultTokenStorage.setToken('valid-persisted-token');
    vi.spyOn(api.auth, 'me').mockResolvedValueOnce({
      id: '01a1ab51-d6a2-7116-99b9-0f0d52de1527',
      email: 'user1@local.test',
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

    renderApp('/projects');

    expect(await screen.findByRole('heading', { level: 1, name: /available projects/i })).toBeInTheDocument();
    expect(await screen.findByText('Test Project')).toBeInTheDocument();
  });

  it('logs out, clears authenticated state, and denies subsequent access to protected screen', async () => {
    defaultTokenStorage.setToken('active-token');
    vi.spyOn(api.auth, 'me').mockResolvedValueOnce({
      id: 'u-1',
      email: 'user1@local.test',
    });
    vi.spyOn(api.auth, 'logout').mockResolvedValueOnce();
    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValueOnce({
      board: {
        id: 'b-1',
        projectId: 'p-1',
        name: 'Test Board',
        columns: [{ id: 'c-1', name: 'Backlog', category: ColumnCategory.Backlog, position: 'V' }],
      },
      tasks: [],
    });

    renderApp('/tasks');

    // Currently authenticated and on tasks page
    expect(await screen.findByRole('heading', { level: 1, name: /test board/i })).toBeInTheDocument();

    // Click logout
    const logoutBtn = screen.getByRole('button', { name: /log out/i });
    fireEvent.click(logoutBtn);

    // Redirected to login page
    expect(await screen.findByRole('heading', { level: 1, name: /log in/i })).toBeInTheDocument();
    expect(defaultTokenStorage.getToken()).toBeNull();

    // Clean up current DOM tree before re-mounting at protected route
    cleanup();

    // Try navigating to protected screen after logout
    renderApp('/projects');
    expect(await screen.findByRole('heading', { level: 1, name: /log in/i })).toBeInTheDocument();
  });
});
