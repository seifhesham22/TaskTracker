import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColumnCategory, TaskPriority, type BacklogItem } from '../../domain/models';
import { BacklogFilterBar } from './BacklogFilterBar';
import { BacklogItemCard } from './BacklogItemCard';
import { BacklogPagination } from './BacklogPagination';
import { BacklogSkeleton } from './BacklogSkeleton';

describe('Backlog Components Unit Tests', () => {
  const item: BacklogItem = {
    id: 'item-1',
    readableId: 'TES-100',
    number: 100,
    boardId: 'board-1',
    title: 'Deploy to Kubernetes',
    status: ColumnCategory.InProgress,
    priority: TaskPriority.Critical,
  };

  it('renders BacklogItemCard with index, readableId, title, status, and priority', () => {
    render(<BacklogItemCard positionIndex={5} item={item} />);

    expect(screen.getByText('5 · TES-100')).toBeInTheDocument();
    expect(screen.getByText('Deploy to Kubernetes')).toBeInTheDocument();
    expect(screen.getByText(/In progress · Critical/i)).toBeInTheDocument();
  });

  it('renders BacklogFilterBar and triggers search and filter callbacks', () => {
    const onSearchChange = vi.fn();
    const onStatusChange = vi.fn();
    const onPriorityChange = vi.fn();

    render(
      <BacklogFilterBar
        search="deploy"
        status={ColumnCategory.InProgress}
        priority={TaskPriority.Critical}
        onSearchChange={onSearchChange}
        onStatusChange={onStatusChange}
        onPriorityChange={onPriorityChange}
      />
    );

    const searchInput = screen.getByLabelText('Search tasks by title');
    expect(searchInput).toHaveValue('deploy');
    fireEvent.change(searchInput, { target: { value: 'release' } });
    expect(onSearchChange).toHaveBeenCalledWith('release');

    const statusSelect = screen.getByLabelText('Filter by status');
    expect(statusSelect).toHaveValue(ColumnCategory.InProgress);
    fireEvent.change(statusSelect, { target: { value: ColumnCategory.Done } });
    expect(onStatusChange).toHaveBeenCalledWith(ColumnCategory.Done);

    const prioritySelect = screen.getByLabelText('Filter by priority');
    expect(prioritySelect).toHaveValue(TaskPriority.Critical);
    fireEvent.change(prioritySelect, { target: { value: 'NONE' } });
    expect(onPriorityChange).toHaveBeenCalledWith('NONE');
  });

  it('renders BacklogPagination with controls and handles page clicks', () => {
    const onPageChange = vi.fn();

    render(
      <BacklogPagination
        page={2}
        totalPages={5}
        totalCount={50}
        hasPreviousPage={true}
        hasNextPage={true}
        onPageChange={onPageChange}
      />
    );

    expect(screen.getByText('Page 2 of 5 · 50 items')).toBeInTheDocument();

    const prevBtn = screen.getByTestId('backlog-prev-page-btn');
    const nextBtn = screen.getByTestId('backlog-next-page-btn');

    expect(prevBtn).toBeEnabled();
    expect(nextBtn).toBeEnabled();

    fireEvent.click(prevBtn);
    expect(onPageChange).toHaveBeenCalledWith(1);

    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('renders BacklogSkeleton with loading status role', () => {
    render(<BacklogSkeleton />);

    expect(screen.getByRole('status', { name: 'Loading backlog…' })).toBeInTheDocument();
    expect(screen.getByText('Loading backlog…')).toBeInTheDocument();
  });
});
