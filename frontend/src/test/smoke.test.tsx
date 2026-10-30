import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { routes } from '../app/routes';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

describe('smoke', () => {
  it('renders the Home page and reports the backend status', async () => {
    vi.spyOn(api.system, 'checkStatus').mockResolvedValue('online');

    renderAt('/');

    expect(
      screen.getByRole('heading', { level: 1, name: /plan, track and ship/i }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('Online');
  });

  it('falls back to the 404 page for unknown routes', () => {
    renderAt('/this-route-does-not-exist');

    expect(screen.getByRole('heading', { level: 1, name: /page not found/i })).toBeInTheDocument();
  });
});
