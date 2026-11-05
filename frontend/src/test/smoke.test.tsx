import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { routes } from '../app/routes';
import { ColumnCategory } from '../domain/models';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

describe('smoke', () => {
  it('renders the board as the main page', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue({
      board: {
        id: '01a18766-48b5-7fb8-a04c-13e1bf648def',
        projectId: 'p-1',
        projectName: 'Test Project',
        name: 'Test Board',
        columns: [
          { id: 'c-1', name: 'Backlog', category: ColumnCategory.Backlog, position: '0|hzzzzz:' },
        ],
      },
      tasks: [],
    });

    renderAt('/');

    expect(await screen.findByRole('heading', { level: 1, name: /test board/i })).toBeInTheDocument();
  });

  it('falls back to the 404 page for unknown routes', () => {
    renderAt('/this-route-does-not-exist');

    expect(screen.getByRole('heading', { level: 1, name: /page not found/i })).toBeInTheDocument();
  });
});
