import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColumnCategory, type BlockedTaskStartFailure } from '../../domain/models';
import { BlockedTaskStartModal } from './BlockedTaskStartModal';

describe('BlockedTaskStartModal', () => {
  const mockFailure: BlockedTaskStartFailure = {
    taskId: 'task-24',
    taskTitle: 'Prepare launch checklist',
    readableId: 'TES-24',
    projectName: 'Website redesign',
    currentStatus: ColumnCategory.ToDo,
    currentColumnName: 'To do',
    targetColumnId: 'col-inprogress',
    blockers: [
      {
        id: 'task-18',
        readableId: 'TES-18',
        title: 'Approve scope',
        status: ColumnCategory.InProgress,
      },
    ],
    message: "TES-24 is blocked by this unfinished task: TES-18 (Approve scope).",
  };

  it('renders State 01: blocked-start explanation with blocker details', () => {
    render(
      <BlockedTaskStartModal
        failure={mockFailure}
        isOpen={true}
        onClose={vi.fn()}
        onRecheck={vi.fn()}
        onStartTask={vi.fn()}
      />
    );

    expect(screen.getByText('Prepare launch checklist')).toBeInTheDocument();
    expect(screen.getByText('Website redesign / TES-24')).toBeInTheDocument();
    expect(screen.getByTestId('blocked-task-status-badge')).toHaveTextContent('To do');
    expect(screen.getByTestId('blocked-start-explanation-banner')).toHaveTextContent(
      'This task can’t start yet. Complete its prerequisites.'
    );
    expect(screen.getByTestId('blocker-item-task-18')).toHaveTextContent('TES-18 · Approve scope');
    expect(screen.getByTestId('check-again-btn')).toBeInTheDocument();
    expect(screen.getByTestId('back-to-board-btn')).toBeInTheDocument();
  });

  it('renders State 02: desktop drag-and-drop rollback banner', () => {
    render(
      <BlockedTaskStartModal
        failure={mockFailure}
        isOpen={true}
        rollbackBanner="Move reverted · TES-24 stays in To do."
        onClose={vi.fn()}
        onRecheck={vi.fn()}
        onStartTask={vi.fn()}
      />
    );

    const rollbackBanner = screen.getByTestId('rollback-banner');
    expect(rollbackBanner).toHaveTextContent('Move reverted · TES-24 stays in To do.');
  });

  it('renders State 03: mobile status selection box with unavailable active status and blocker hint', () => {
    render(
      <BlockedTaskStartModal
        failure={mockFailure}
        isOpen={true}
        onClose={vi.fn()}
        onRecheck={vi.fn()}
        onStartTask={vi.fn()}
      />
    );

    expect(screen.getByTestId('mobile-status-selection-box')).toBeInTheDocument();
    expect(screen.getByText(/Unavailable · 1 unfinished blocker/i)).toBeInTheDocument();
    expect(screen.getByText('Finish TES-18 before starting this task.')).toBeInTheDocument();
    expect(screen.getByTestId('view-blocker-btn')).toBeInTheDocument();
  });

  it('renders State 04: navigates to prerequisite on "Open blocker" and returns via "Back to blocked task"', () => {
    render(
      <BlockedTaskStartModal
        failure={mockFailure}
        isOpen={true}
        onClose={vi.fn()}
        onRecheck={vi.fn()}
        onStartTask={vi.fn()}
      />
    );

    const openBlockerBtn = screen.getByTestId('open-blocker-task-18');
    fireEvent.click(openBlockerBtn);

    expect(screen.getByTestId('prerequisite-detail-view')).toBeInTheDocument();
    expect(screen.getByText('Approve scope')).toBeInTheDocument();
    expect(screen.getByText('Website redesign / TES-18')).toBeInTheDocument();
    expect(screen.getByTestId('prerequisite-blocks-banner')).toHaveTextContent(
      'This task blocks TES-24.'
    );

    const backBtn = screen.getByTestId('back-to-blocked-task-btn');
    fireEvent.click(backBtn);

    expect(screen.queryByTestId('prerequisite-detail-view')).not.toBeInTheDocument();
    expect(screen.getByText('Prepare launch checklist')).toBeInTheDocument();
  });

  it('renders State 05 & 06: rechecks prerequisites, shows progress and displays State 06 when resolved', async () => {
    const onRecheck = vi.fn().mockImplementation(async () => {
      // Simulate resolving blocker
      return [{ id: 'task-18', readableId: 'TES-18', title: 'Approve scope', status: ColumnCategory.Done }];
    });

    render(
      <BlockedTaskStartModal
        failure={mockFailure}
        isOpen={true}
        onClose={vi.fn()}
        onRecheck={onRecheck}
        onStartTask={vi.fn()}
      />
    );

    const checkAgainBtn = screen.getByTestId('check-again-btn');
    fireEvent.click(checkAgainBtn);

    await waitFor(() => {
      expect(onRecheck).toHaveBeenCalledWith('task-24');
    });

    expect(screen.getByTestId('all-prerequisites-complete-banner')).toHaveTextContent(
      'All prerequisites are complete or removed.'
    );
    expect(screen.getByTestId('start-task-btn')).toBeInTheDocument();
  });

  it('renders State 07: starts task and confirms transition to In progress', async () => {
    const onRecheck = vi.fn().mockResolvedValue([]);
    const onStartTask = vi.fn().mockResolvedValue(true);

    render(
      <BlockedTaskStartModal
        failure={mockFailure}
        isOpen={true}
        onClose={vi.fn()}
        onRecheck={onRecheck}
        onStartTask={onStartTask}
      />
    );

    // Resolve prerequisites first
    fireEvent.click(screen.getByTestId('check-again-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('start-task-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('start-task-btn'));

    await waitFor(() => {
      expect(onStartTask).toHaveBeenCalledWith('task-24', 'col-inprogress');
    });

    expect(screen.getByTestId('task-started-banner')).toHaveTextContent('✓ Task started');
    expect(screen.getByTestId('blocked-task-status-badge')).toHaveTextContent('In progress');
    expect(screen.getByTestId('back-to-board-btn')).toBeInTheDocument();
  });

  it('renders State 08: handles verification/transition failure and provides "Try again"', async () => {
    const onRecheck = vi.fn().mockRejectedValue(new Error('Network error'));

    render(
      <BlockedTaskStartModal
        failure={mockFailure}
        isOpen={true}
        onClose={vi.fn()}
        onRecheck={onRecheck}
        onStartTask={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('check-again-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('verification-failure-banner')).toHaveTextContent(
        'Couldn’t verify prerequisites. The task was not started.'
      );
    });

    expect(screen.getByTestId('try-again-btn')).toBeInTheDocument();
  });
});
