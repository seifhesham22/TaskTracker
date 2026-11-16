import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ColumnCategory, type TaskItem } from '../../domain/models';
import { TaskDependenciesModal } from './TaskDependenciesModal';

describe('TaskDependenciesModal (7 Figma States)', () => {
  const currentTask: TaskItem = {
    id: 'task-current',
    readableId: 'TES-24',
    number: 24,
    boardId: 'b-1',
    title: 'Prepare the project launch',
    status: ColumnCategory.InProgress,
    columnId: 'col-1',
    assigneeIds: [],
    blockedBy: [
      {
        id: 'task-predecessor',
        readableId: 'TES-18',
        title: 'Approve project scope',
        status: ColumnCategory.InProgress,
      },
    ],
    blocks: [],
  };

  const otherTask: TaskItem = {
    id: 'task-other',
    readableId: 'TES-10',
    number: 10,
    boardId: 'b-1',
    title: 'Design database schema',
    status: ColumnCategory.Done,
    columnId: 'col-done',
    assigneeIds: [],
  };

  it('State 01: renders existing dependencies with relationship direction and Add dependency button', () => {
    render(
      <TaskDependenciesModal
        task={currentTask}
        allTasks={[currentTask, otherTask]}
        projectName="Test Project"
        isOpen={true}
        onClose={vi.fn()}
        onAddDependency={vi.fn()}
      />
    );

    expect(screen.getByText('Task dependencies')).toBeInTheDocument();
    expect(screen.getByText(/Test Project \/ TES-24/i)).toBeInTheDocument();
    expect(screen.getByText(/Blocked by · 1 task/i)).toBeInTheDocument();
    expect(screen.getByText('Approve project scope')).toBeInTheDocument();
    expect(
      screen.getByText('TES-18 · Approve project scope ↓ must happen before TES-24')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add dependency' })).toBeInTheDocument();
  });

  it('State 02: opens selection form with relationship dropdown and search input', async () => {
    const user = userEvent.setup();
    render(
      <TaskDependenciesModal
        task={currentTask}
        allTasks={[currentTask, otherTask]}
        projectName="Test Project"
        isOpen={true}
        onClose={vi.fn()}
        onAddDependency={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Add dependency' }));

    expect(
      screen.getByText(/CURRENT TASK · TES-24 Prepare the project launch/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Relationship/i)).toBeInTheDocument();
    expect(
      screen.getByText(/The selected task must finish before TES-24\./i)
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Search by title or task key')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('State 03: announces loading matching tasks while search is active', async () => {
    const user = userEvent.setup();
    let resolveSearch: (tasks: TaskItem[]) => void;
    const searchPromise = new Promise<TaskItem[]>((resolve) => {
      resolveSearch = resolve;
    });

    render(
      <TaskDependenciesModal
        task={currentTask}
        allTasks={[currentTask, otherTask]}
        projectName="Test Project"
        isOpen={true}
        onClose={vi.fn()}
        onAddDependency={vi.fn()}
        onSearchTasks={() => searchPromise}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Add dependency' }));
    await user.type(screen.getByPlaceholderText('Search by title or task key'), 'Design');

    expect(screen.getByText('Loading matching tasks…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled();

    // Resolve search
    resolveSearch!([otherTask]);
    await waitFor(() => {
      expect(screen.queryByText('Loading matching tasks…')).not.toBeInTheDocument();
    });
  });

  it('State 04: shows selection validation error when submitting without selecting a task', async () => {
    const user = userEvent.setup();
    render(
      <TaskDependenciesModal
        task={currentTask}
        allTasks={[currentTask, otherTask]}
        projectName="Test Project"
        isOpen={true}
        onClose={vi.fn()}
        onAddDependency={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Add dependency' }));
    await user.click(screen.getByRole('button', { name: 'Add dependency' }));

    expect(screen.getByText('Select a task to continue.')).toBeInTheDocument();
  });

  it('State 05 & 06: shows adding state and success banner with updated direction', async () => {
    const user = userEvent.setup();
    let resolveAdd: (ok: boolean) => void;
    const addPromise = new Promise<boolean>((resolve) => {
      resolveAdd = resolve;
    });
    const onAddDependency = vi.fn().mockReturnValue(addPromise);

    render(
      <TaskDependenciesModal
        task={currentTask}
        allTasks={[currentTask, otherTask]}
        projectName="Test Project"
        isOpen={true}
        onClose={vi.fn()}
        onAddDependency={onAddDependency}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Add dependency' }));
    await waitFor(() => {
      expect(screen.getByText('Design database schema')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Design database schema'));

    // Direction preview appears
    expect(
      screen.getByText('TES-10 · Design database schema ↓ must happen before TES-24')
    ).toBeInTheDocument();

    // Click submit
    await user.click(screen.getByRole('button', { name: 'Add dependency' }));

    // State 05: Adding in progress
    expect(screen.getByRole('button', { name: '◌ Adding…' })).toBeDisabled();

    // State 06: Resolve success
    resolveAdd!(true);
    await waitFor(() => {
      expect(screen.getByText('✓ Dependency added')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Add another dependency' })
      ).toBeInTheDocument();
    });
  });

  it('State 07: shows error banner and preserves selection for retry on generic request failure', async () => {
    const user = userEvent.setup();
    const onAddDependency = vi
      .fn()
      .mockRejectedValue(new Error('Network connection timeout.'));

    render(
      <TaskDependenciesModal
        task={currentTask}
        allTasks={[currentTask, otherTask]}
        projectName="Test Project"
        isOpen={true}
        onClose={vi.fn()}
        onAddDependency={onAddDependency}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Add dependency' }));
    await waitFor(() => {
      expect(screen.getByText('Design database schema')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Design database schema'));

    await user.click(screen.getByRole('button', { name: 'Add dependency' }));

    await waitFor(() => {
      expect(screen.getByText('Network connection timeout.')).toBeInTheDocument();
      // Retains selection & direction
      expect(
        screen.getByText('TES-10 · Design database schema ↓ must happen before TES-24')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add dependency' })).toBeEnabled();
    });
  });

  describe('[US-18] Circular Dependency Validation (T1WOR-119 3 States)', () => {
    const cycleTask: TaskItem = {
      id: 'task-cycle-27',
      readableId: 'TES-27',
      number: 27,
      boardId: 'b-1',
      title: 'Publish release notes',
      status: ColumnCategory.ToDo,
      columnId: 'col-todo',
      assigneeIds: [],
    };

    const validTask: TaskItem = {
      id: 'task-valid-18',
      readableId: 'TES-18',
      number: 18,
      boardId: 'b-1',
      title: 'Approve project scope',
      status: ColumnCategory.ToDo,
      columnId: 'col-todo',
      assigneeIds: [],
    };

    const baseTask: TaskItem = {
      id: 'task-base-24',
      readableId: 'TES-24',
      number: 24,
      boardId: 'b-1',
      title: 'Prepare the project launch',
      status: ColumnCategory.InProgress,
      columnId: 'col-prog',
      assigneeIds: [],
      blockedBy: [],
      blocks: [],
    };

    it('handles circular dependency cycle rejection, allows correction, and confirms valid retry', async () => {
      const user = userEvent.setup();
      const onAddDependency = vi
        .fn()
        .mockRejectedValueOnce(
          new Error(
            "TES-27 can't block TES-24: TES-24 already blocks TES-27 (TES-24 → TES-27), so this would create a cycle."
          )
        )
        .mockResolvedValueOnce(true);

      render(
        <TaskDependenciesModal
          task={baseTask}
          allTasks={[baseTask, cycleTask, validTask]}
          projectName="Test Project"
          isOpen={true}
          onClose={vi.fn()}
          onAddDependency={onAddDependency}
        />
      );

      // Start add
      await user.click(screen.getByRole('button', { name: 'Add dependency' }));

      // Select cycle candidate TES-27
      await waitFor(() => {
        expect(screen.getByTestId(`dependency-candidate-${cycleTask.id}`)).toBeInTheDocument();
      });
      await user.click(screen.getByTestId(`dependency-candidate-${cycleTask.id}`));
      await user.click(screen.getByRole('button', { name: 'Add dependency' }));

      // State 01: Cycle rejected banner and path box
      await waitFor(() => {
        expect(screen.getByTestId('cycle-error-banner')).toBeInTheDocument();
        expect(screen.getByText('This dependency creates a cycle.')).toBeInTheDocument();
        expect(
          screen.getByText('TES-27 already depends on TES-24. Choose another task.')
        ).toBeInTheDocument();
        expect(screen.getByText(/Existing: TES-24 → TES-27/i)).toBeInTheDocument();
        expect(screen.getByText(/Rejected: TES-27 → TES-24/i)).toBeInTheDocument();
      });

      // Primary button is "Choose another task"
      const chooseAnotherBtn = screen.getByTestId('choose-another-task-btn');
      expect(chooseAnotherBtn).toBeInTheDocument();
      await user.click(chooseAnotherBtn);

      // State 02: Correct and retry
      expect(screen.getByLabelText('Choose another task')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search tasks…')).toBeInTheDocument();

      // Rejected candidate is filtered out
      expect(screen.queryByTestId(`dependency-candidate-${cycleTask.id}`)).not.toBeInTheDocument();

      // Select valid candidate TES-18
      const validCandidate = screen.getByTestId(`dependency-candidate-${validTask.id}`);
      await user.click(validCandidate);

      // Button updates to "Retry with TES-18"
      const retryBtn = screen.getByRole('button', { name: 'Retry with TES-18' });
      expect(retryBtn).toBeInTheDocument();

      // Submit retry
      await user.click(retryBtn);

      // State 03: Valid retry saved
      await waitFor(() => {
        expect(screen.getByText('✓ Dependency added')).toBeInTheDocument();
        expect(screen.getByTestId('cycle-rejected-notice')).toHaveTextContent(
          'The rejected TES-27 link was never added.'
        );
        expect(screen.getByRole('button', { name: 'Back to task' })).toBeInTheDocument();
      });
    });
  });
});
