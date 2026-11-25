import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ProjectBoardsView } from './ProjectBoardsView';

describe('ProjectBoardsView', () => {
  const defaultBoards = [
    { id: 'b-1', name: 'Sprint 2' },
  ];

  it('renders Owner view with Create board control (State 01)', async () => {
    const user = userEvent.setup();
    const onCreateBoard = vi.fn();

    render(
      <MemoryRouter>
        <ProjectBoardsView
          projectName="Website redesign"
          role="OWNER"
          isOwner={true}
          boards={defaultBoards}
          onCreateBoard={onCreateBoard}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Project boards' })).toBeInTheDocument();
    expect(screen.getByTestId('project-boards-subtitle')).toHaveTextContent(
      'Website redesign · Owner'
    );
    expect(screen.getByText('Sprint 2')).toBeInTheDocument();
    expect(screen.getByText('Board · Website redesign')).toBeInTheDocument();
    expect(screen.getByTestId('open-board-btn-b-1')).toBeInTheDocument();

    const createBtn = screen.getByTestId('start-create-board-btn');
    expect(createBtn).toBeInTheDocument();
    expect(createBtn).toHaveTextContent('Create board');

    await user.click(createBtn);
    expect(onCreateBoard).toHaveBeenCalled();
  });

  it('renders Writer view without Create board control (State 08)', () => {
    render(
      <MemoryRouter>
        <ProjectBoardsView
          projectName="Website redesign"
          role="WRITER"
          isOwner={false}
          boards={defaultBoards}
          onCreateBoard={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId('project-boards-subtitle')).toHaveTextContent(
      'Website redesign · Writer'
    );
    expect(screen.queryByTestId('start-create-board-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('create-board-role-note')).toHaveTextContent(
      'Only an Owner can create boards.'
    );
  });

  it('renders Reader view without Create board control (State 09)', () => {
    render(
      <MemoryRouter>
        <ProjectBoardsView
          projectName="Website redesign"
          role="READER"
          isOwner={false}
          boards={defaultBoards}
          onCreateBoard={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId('project-boards-subtitle')).toHaveTextContent(
      'Website redesign · Reader'
    );
    expect(screen.queryByTestId('start-create-board-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('create-board-role-note')).toHaveTextContent(
      'Only an Owner can create boards.'
    );
  });
});
