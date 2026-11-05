import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BoardDetails, CreateTaskInput, TaskItem } from '../../domain/models';
import { BoardColumn } from './BoardColumn';
import { BoardHeader } from './BoardHeader';
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
  readonly savingTaskIds?: ReadonlySet<string>;
  readonly moveError?: string | null;
  readonly onClearMoveError?: () => void;
  readonly onReload?: () => void;
  readonly onCreateTask: (input: CreateTaskInput) => Promise<boolean>;
  readonly onMoveTask?: (taskId: string, targetColumnId: string) => Promise<boolean>;
}

export function BoardView({
  board,
  tasks,
  isLoading,
  error,
  isNotFound,
  isCreatingTask,
  createTaskError,
  savingTaskIds,
  moveError,
  onClearMoveError,
  onReload,
  onCreateTask,
  onMoveTask,
}: BoardViewProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<string | undefined>(undefined);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const updateScrollState = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const hasMore = el.scrollWidth - el.clientWidth - el.scrollLeft > 2;
    setCanScrollRight(hasMore);
  }, []);

  const columnsWithTasks = useMemo(() => {
    if (!board?.columns || board.columns.length === 0) {
      return [];
    }

    const sortedColumns = [...board.columns].sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0));

    return sortedColumns.map((col) => {
      const colTasks = tasks.filter((t) => t.columnId === col.id || (!t.columnId && t.status === col.category));
      return {
        column: col,
        tasks: colTasks,
      };
    });
  }, [board, tasks]);

  useEffect(() => {
    updateScrollState();
    window.addEventListener('resize', updateScrollState);
    return () => window.removeEventListener('resize', updateScrollState);
  }, [columnsWithTasks, updateScrollState]);

  if (isLoading) {
    return (
      <div className="board-view__skeleton" role="status" aria-busy="true" aria-label="Loading tasks">
        <div className="skeleton-head">
          <i />
          <i />
        </div>
        <div className="skeleton-columns">
          <div><i /><b /><b /><b /></div>
          <div><i /><b /><b /></div>
          <div><i /><b /><b /></div>
          <div><i /><b /></div>
        </div>
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="board-view__state-box" role="alert" data-testid="board-not-found">
        <div className="state-content">
          <img src="/assets/f5a1e.svg" alt="" width="48" height="48" />
          <h4>Board not found</h4>
          <p>This board doesn't exist or was deleted. Check the link, or go back to your boards.</p>
          <a href="/boards" className="button button-dark">
            <img src="/assets/6c970.svg" alt="" width="16" height="16" />
            Go to boards
          </a>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="board-view__state-box board-view__state-box--error" role="alert" data-testid="board-error">
        <div className="state-content">
          <img src="/assets/871e4.svg" alt="" width="48" height="48" />
          <h4>Couldn't load this board</h4>
          <span className="visually-hidden">Failed to load board</span>
          <p>Something went wrong while loading the tasks. Check your connection and try again.</p>
          {onReload && (
            <button
              type="button"
              className="button button-outline"
              onClick={onReload}
            >
              <img src="/assets/5dbe0.svg" alt="" width="16" height="16" />
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  const selectedColumn = board?.columns.find((c) => c.id === selectedColumnId);

  return (
    <div className="board-view" data-testid="board-view">
      <BoardHeader
        projectName={board?.projectName}
        boardName={board?.name}
        taskCount={tasks.length}
        onOpenCreateTask={() => {
          setSelectedColumnId(undefined);
          setIsCreateModalOpen(true);
        }}
      />

      {moveError && (
        <div className="board-alert board-alert--error" role="alert" data-testid="board-move-error">
          <img src="/assets/871e4.svg" alt="" width="16" height="16" />
          <span>{moveError}</span>
          {onClearMoveError && (
            <button
              type="button"
              className="board-alert__close"
              aria-label="Dismiss error"
              onClick={onClearMoveError}
            >
              ✕
            </button>
          )}
        </div>
      )}

      <div className="board-columns-wrapper">
        <div
          ref={scrollContainerRef}
          className="board-columns"
          role="region"
          aria-label="Task board columns"
          onScroll={updateScrollState}
        >
          {columnsWithTasks.map(({ column, tasks: colTasks }) => (
            <BoardColumn
              key={column.id}
              column={column}
              tasks={colTasks}
              members={board?.members}
              savingTaskIds={savingTaskIds}
              onDropTask={onMoveTask}
              onAddTask={(colId) => {
                setSelectedColumnId(colId);
                setIsCreateModalOpen(true);
              }}
            />
          ))}
        </div>
        {canScrollRight && <div className="board-columns-fade" aria-hidden="true" />}
      </div>

      {board && (
        <CreateTaskForm
          boardId={board.id}
          boardName={board.name}
          columnId={selectedColumnId}
          columnName={selectedColumn?.name || board.columns[0]?.name || 'Backlog'}
          members={board.members}
          isOpen={isCreateModalOpen}
          isSubmitting={isCreatingTask}
          serverError={createTaskError}
          onClose={() => {
            setIsCreateModalOpen(false);
            setSelectedColumnId(undefined);
          }}
          onSubmit={onCreateTask}
        />
      )}
    </div>
  );
}
