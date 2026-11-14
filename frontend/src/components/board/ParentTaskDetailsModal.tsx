import { useId, useMemo } from 'react';
import { ColumnCategory, type BoardColumnModel, type TaskItem } from '../../domain/models';
import './ParentTaskDetailsModal.css';

export interface ParentTaskDetailsModalProps {
  readonly task: TaskItem | null;
  readonly allTasks: readonly TaskItem[];
  readonly projectName?: string | null;
  readonly isOpen: boolean;
  readonly showSuccessBanner?: boolean;
  readonly onClose: () => void;
  readonly onAddSubtask: () => void;
  readonly onMoveTask?: (taskId: string, targetColumnId: string) => Promise<boolean>;
  readonly columns?: readonly BoardColumnModel[];
}

export function ParentTaskDetailsModal({
  task,
  allTasks,
  projectName,
  isOpen,
  showSuccessBanner = false,
  onClose,
  onAddSubtask,
  onMoveTask,
  columns,
}: ParentTaskDetailsModalProps) {
  const headingId = useId();

  const subtasks = useMemo(() => {
    if (!task) return [];
    return allTasks.filter((t) => t.parentTaskId === task.id);
  }, [task, allTasks]);

  const doneCount = useMemo(() => {
    return subtasks.filter((s) => s.status === ColumnCategory.Done).length;
  }, [subtasks]);

  if (!isOpen || !task) {
    return null;
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleToggleSubtask = async (sub: TaskItem) => {
    if (!onMoveTask || !columns || columns.length === 0) return;
    const isDone = sub.status === ColumnCategory.Done;
    if (isDone) {
      const targetCol =
        columns.find((c) => c.category === ColumnCategory.ToDo) ||
        columns.find((c) => c.category === ColumnCategory.Backlog) ||
        columns[0];
      if (targetCol && targetCol.id !== sub.columnId) {
        await onMoveTask(sub.id, targetCol.id);
      }
    } else {
      const targetCol = columns.find((c) => c.category === ColumnCategory.Done);
      if (targetCol && targetCol.id !== sub.columnId) {
        await onMoveTask(sub.id, targetCol.id);
      }
    }
  };

  const isParentDone = task.status === ColumnCategory.Done;

  const handleMarkComplete = async () => {
    if (!onMoveTask || !columns || isParentDone) {
      onClose();
      return;
    }
    const doneCol = columns.find((c) => c.category === ColumnCategory.Done);
    if (doneCol && doneCol.id !== task.columnId) {
      await onMoveTask(task.id, doneCol.id);
    }
    onClose();
  };

  const displayProject = projectName || 'Project';
  const statusLabel = formatStatus(task.status, task.columnName);
  const statusIcon = getStatusIcon(task.status);

  return (
    <div
      className="task-details-backdrop"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        className="task-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={(e) => e.stopPropagation()}
        data-testid="parent-task-details-modal"
      >
        <div className="task-details-header">
          <div style={{ flex: 1 }}>
            <p className="task-details-eyebrow">
              {displayProject} / {task.readableId}
            </p>
            <div className="task-details-title-row">
              <h2 id={headingId} className="task-details-title">
                {task.title}
              </h2>
              <span className="task-details-status-badge">
                <span>{statusIcon}</span>
                <span>{statusLabel}</span>
              </span>
            </div>
          </div>
          <button
            type="button"
            className="task-details-close"
            onClick={onClose}
            aria-label="Close details"
            data-testid="close-parent-task-details"
          >
            ×
          </button>
        </div>

        {showSuccessBanner && (
          <div
            className="task-details-success-banner"
            role="status"
            aria-live="polite"
            data-testid="subtask-created-banner"
          >
            ✓ Subtask created
          </div>
        )}

        {task.description && (
          <p className="task-details-description">
            {task.description}
          </p>
        )}

        <div className="task-details-subtasks-section">
          <div className="task-details-subtasks-header">
            <h3 className="task-details-subtasks-title">Subtasks</h3>
            {subtasks.length > 0 && (
              <span
                className="task-details-subtasks-count"
                data-testid="subtasks-completion-count"
              >
                {doneCount} / {subtasks.length} done
              </span>
            )}
          </div>

          <div className="task-details-subtasks-margin">
            <div className="task-details-subtasks-list" role="list">
              {subtasks.length === 0 ? (
                <p className="subtasks-empty-text" data-testid="no-subtasks-text">
                  No subtasks yet. Break this task into clear steps.
                </p>
              ) : (
                subtasks.map((sub) => {
                  const subStatusLabel = formatStatus(sub.status, sub.columnName);
                  const subStatusIcon = getStatusIcon(sub.status);
                  const canToggle = Boolean(onMoveTask && columns && columns.length > 0);

                  return (
                    <div
                      key={sub.id}
                      className={`subtask-item-card ${canToggle ? 'subtask-item-card--clickable' : ''}`}
                      role={canToggle ? 'button' : 'listitem'}
                      tabIndex={canToggle ? 0 : undefined}
                      data-testid={`subtask-item-${sub.id}`}
                      onClick={canToggle ? () => handleToggleSubtask(sub) : undefined}
                      onKeyDown={
                        canToggle
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleToggleSubtask(sub);
                              }
                            }
                          : undefined
                      }
                      title={canToggle ? `Click to toggle status (currently ${subStatusLabel})` : undefined}
                    >
                      <p className="subtask-item-eyebrow">
                        {sub.readableId} · {subStatusLabel}
                      </p>
                      <p className="subtask-item-title">
                        <span className="subtask-item-icon">{subStatusIcon}</span>
                        <span>{sub.title}</span>
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="task-details-actions">
          <button
            type="button"
            className="task-details-button task-details-button-secondary"
            onClick={onAddSubtask}
            data-testid="add-subtask-button"
          >
            Add subtask
          </button>
          <button
            type="button"
            className="task-details-button task-details-button-primary"
            onClick={handleMarkComplete}
            data-testid="close-task-details-button"
          >
            {isParentDone ? 'Close' : 'Mark complete'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatStatus(category: ColumnCategory, columnName?: string): string {
  if (columnName) return columnName;
  switch (category) {
    case ColumnCategory.Backlog:
      return 'Backlog';
    case ColumnCategory.ToDo:
      return 'To do';
    case ColumnCategory.InProgress:
      return 'In progress';
    case ColumnCategory.Done:
      return 'Done';
    case ColumnCategory.Cancelled:
      return 'Cancelled';
    default:
      return String(category);
  }
}

function getStatusIcon(category: ColumnCategory): string {
  switch (category) {
    case ColumnCategory.Done:
      return '✓';
    case ColumnCategory.InProgress:
      return '◐';
    default:
      return '○';
  }
}
