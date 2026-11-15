import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ColumnCategory,
  type BoardDetails,
  type CreateTaskInput,
  type TaskItem,
  type UpdateTaskInput,
} from '../../domain/models';
import { BoardColumn } from './BoardColumn';
import { BoardHeader } from './BoardHeader';
import { CreateTaskForm } from './CreateTaskForm';
import {
  ParentTaskDetailsModal,
  type BlockedIncompleteSubtasksInfo,
} from './ParentTaskDetailsModal';
import { CreateSubtaskModal } from './CreateSubtaskModal';
import { EditTaskModal } from './EditTaskModal';
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
  readonly incompleteSubtasksError?: BlockedIncompleteSubtasksInfo | null;
  readonly onClearMoveError?: () => void;
  readonly onClearIncompleteSubtasksError?: () => void;
  readonly onReload?: () => void;
  readonly onCreateTask: (input: CreateTaskInput) => Promise<boolean>;
  readonly onCreateSubtask?: (parentTask: TaskItem, title: string) => Promise<boolean>;
  readonly onMoveTask?: (taskId: string, targetColumnId: string) => Promise<boolean>;
  readonly onUpdateTask?: (input: UpdateTaskInput) => Promise<TaskItem>;
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
  incompleteSubtasksError,
  onClearMoveError,
  onClearIncompleteSubtasksError,
  onReload,
  onCreateTask,
  onCreateSubtask,
  onMoveTask,
  onUpdateTask,
}: BoardViewProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<string | undefined>(undefined);

  // Single unified task details & subtasks modal state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [parentTaskForSubtask, setParentTaskForSubtask] = useState<TaskItem | null>(null);
  const [showSubtaskCreatedBanner, setShowSubtaskCreatedBanner] = useState(false);

  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<TaskItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [justUpdatedTaskId, setJustUpdatedTaskId] = useState<string | null>(null);

  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const activeTargetId = selectedTaskId || incompleteSubtasksError?.taskId || null;
  const activeTask = useMemo(() => {
    if (!activeTargetId) return null;
    return tasks.find((t) => t.id === activeTargetId) ?? null;
  }, [activeTargetId, tasks]);

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

    const sortedColumns = [...board.columns].sort((a, b) =>
      a.position < b.position ? -1 : a.position > b.position ? 1 : 0
    );

    return sortedColumns.map((col) => {
      const colTasks = tasks.filter(
        (t) => t.columnId === col.id || (!t.columnId && t.status === col.category)
      );
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

  const handleOpenTaskDetails = (task: TaskItem) => {
    setSelectedTaskId(task.id);
    setShowSubtaskCreatedBanner(false);
  };

  const handleEditTask = (task: TaskItem) => {
    setSelectedTaskForEdit(task);
    setIsEditModalOpen(true);
  };

  const handleOpenAddSubtask = () => {
    if (activeTask) {
      setParentTaskForSubtask(activeTask);
    }
  };

  const handleSubtaskSubmit = async (parentTask: TaskItem, title: string): Promise<boolean> => {
    if (!onCreateSubtask) return false;
    const success = await onCreateSubtask(parentTask, title);
    if (success) {
      setShowSubtaskCreatedBanner(true);
      return true;
    }
    return false;
  };

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
              allTasks={tasks}
              members={board?.members}
              savingTaskIds={savingTaskIds}
              onDropTask={onMoveTask}
              onSelect={handleOpenTaskDetails}
              onSelectTask={handleOpenTaskDetails}
              onEditTask={handleEditTask}
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

      {/* Unified Task Details & Subtasks Modal */}
      <ParentTaskDetailsModal
        task={activeTask}
        allTasks={tasks}
        projectName={board?.projectName || board?.name}
        isOpen={Boolean(activeTask) && !parentTaskForSubtask && !isEditModalOpen}
        showSuccessBanner={showSubtaskCreatedBanner}
        justUpdated={Boolean(justUpdatedTaskId && activeTask && justUpdatedTaskId === activeTask.id)}
        blockedError={
          incompleteSubtasksError && activeTask && incompleteSubtasksError.taskId === activeTask.id
            ? incompleteSubtasksError
            : null
        }
        onClose={() => {
          setSelectedTaskId(null);
          setShowSubtaskCreatedBanner(false);
          setJustUpdatedTaskId(null);
          if (onClearIncompleteSubtasksError) {
            onClearIncompleteSubtasksError();
          }
        }}
        onMarkComplete={async (taskId) => {
          const doneCol = board?.columns.find((c) => c.category === ColumnCategory.Done);
          if (!doneCol || !onMoveTask) return false;
          return await onMoveTask(taskId, doneCol.id);
        }}
        onMoveSubtask={onMoveTask}
        onMoveTask={onMoveTask}
        onAddSubtask={handleOpenAddSubtask}
        onEdit={() => {
          if (activeTask) {
            setSelectedTaskForEdit(activeTask);
            setIsEditModalOpen(true);
          }
        }}
        onClearBlockedError={onClearIncompleteSubtasksError}
        columns={board?.columns}
        members={board?.members}
      />

      <CreateSubtaskModal
        parentTask={parentTaskForSubtask}
        projectName={board?.projectName || board?.name}
        isOpen={Boolean(parentTaskForSubtask)}
        onClose={() => setParentTaskForSubtask(null)}
        onSubmit={handleSubtaskSubmit}
      />

      {selectedTaskForEdit && (
        <EditTaskModal
          task={selectedTaskForEdit}
          projectName={board?.projectName || board?.name}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedTaskForEdit(null);
          }}
          onSubmit={async (input) => {
            if (!onUpdateTask) return false;
            return await onUpdateTask(input);
          }}
          onSuccess={(updatedTask) => {
            setSelectedTaskForEdit(null);
            setSelectedTaskId(updatedTask.id);
            setJustUpdatedTaskId(updatedTask.id);
            setIsEditModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
