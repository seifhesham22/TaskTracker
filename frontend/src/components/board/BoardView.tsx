import { useMemo, useState } from 'react';
import type { BoardColumnModel, BoardDetails, CreateTaskInput, TaskItem } from '../../domain/models';
import { ColumnCategory } from '../../domain/models';
import { DEFAULT_COLUMN_CATEGORIES } from '../../api/services/BoardService';
import { BoardColumn } from './BoardColumn';
import { CreateTaskForm } from './CreateTaskForm';
import './BoardView.css';

export interface BoardViewProps {
  readonly board: BoardDetails | null;
  readonly tasks: readonly TaskItem[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly isNotFound: boolean;
  readonly isCreatingTask: boolean;
  readonly createTaskError?: string | null;
  readonly onReload?: () => void;
  readonly onCreateTask: (input: CreateTaskInput) => Promise<boolean>;
}

export function BoardView({
  board,
  tasks,
  isLoading,
  error,
  isNotFound,
  isCreatingTask,
  createTaskError,
  onReload,
  onCreateTask,
}: BoardViewProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Group tasks by ColumnCategory ensuring stable order and representation even if empty
  const columnsWithTasks = useMemo(() => {
    // Determine columns: prefer board's defined columns if present, otherwise default columns
    const columns: BoardColumnModel[] = board?.columns && board.columns.length > 0
      ? [...board.columns]
      : DEFAULT_COLUMN_CATEGORIES.map((col, idx) => ({
          id: `col-${idx}`,
          name: col.name,
          category: col.category,
          color: col.color,
          position: String.fromCharCode(65 + idx),
        }));

    // Ensure fixed display order: Backlog -> ToDo -> InProgress -> Done -> Cancelled
    const orderMap: Record<ColumnCategory, number> = {
      [ColumnCategory.Backlog]: 1,
      [ColumnCategory.ToDo]: 2,
      [ColumnCategory.InProgress]: 3,
      [ColumnCategory.Done]: 4,
      [ColumnCategory.Cancelled]: 5,
    };

    const sortedColumns = [...columns].sort((a, b) => {
      const orderA = orderMap[a.category] ?? 99;
      const orderB = orderMap[b.category] ?? 99;
      return orderA - orderB;
    });

    return sortedColumns.map((col) => {
      const colTasks = tasks.filter((t) => t.status === col.category);
      return {
        column: col,
        tasks: colTasks,
      };
    });
  }, [board, tasks]);

  if (isLoading) {
    return (
      <div className="board-view__state-box" role="status" aria-label="Loading tasks">
        <div className="board-view__spinner" aria-hidden="true" />
        <p className="board-view__state-title">Loading board tasks...</p>
        <p className="board-view__state-desc">Connecting to the API and gathering status columns.</p>
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="board-view__state-box" role="alert" data-testid="board-not-found">
        <h2 className="board-view__state-title">Board not found</h2>
        <p className="board-view__state-desc">
          {error || 'The requested board could not be found. Please verify the board ID.'}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="board-view__state-box board-view__state-box--error" role="alert" data-testid="board-error">
        <h2 className="board-view__state-title">Failed to load board</h2>
        <p className="board-view__state-desc">{error}</p>
        {onReload && (
          <button
            type="button"
            className="board-view__btn board-view__btn--primary"
            onClick={onReload}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="board-view" data-testid="board-view">
      <div className="board-view__toolbar">
        <div className="board-view__project-info">
          {board?.projectName && (
            <span className="board-view__project-name">{board.projectName}</span>
          )}
        </div>

        <div className="board-view__actions">
          {onReload && (
            <button
              type="button"
              className="board-view__btn board-view__btn--secondary"
              onClick={onReload}
              title="Refresh tasks"
            >
              🔄 Refresh
            </button>
          )}

          {board && (
            <button
              type="button"
              className="board-view__btn board-view__btn--primary"
              onClick={() => setIsCreateModalOpen(true)}
              data-testid="create-task-btn"
            >
              + Create Task
            </button>
          )}
        </div>
      </div>

      {/* Horizontal scrolling canvas container */}
      <div className="board-view__canvas" role="region" aria-label="Task board columns">
        {columnsWithTasks.map(({ column, tasks: colTasks }) => (
          <BoardColumn
            key={column.id || column.category}
            column={column}
            tasks={colTasks}
            members={board?.members}
          />
        ))}
      </div>

      {board && (
        <CreateTaskForm
          boardId={board.id}
          members={board.members}
          isOpen={isCreateModalOpen}
          isSubmitting={isCreatingTask}
          serverError={createTaskError}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={onCreateTask}
        />
      )}
    </div>
  );
}

