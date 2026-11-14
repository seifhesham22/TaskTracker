import type { TaskItem } from '../../domain/models';
import { TaskPriority } from '../../domain/models';
import './TaskDetailsModal.css';

export interface TaskDetailsModalProps {
  readonly task: TaskItem | null;
  readonly projectName?: string | null;
  readonly isOpen: boolean;
  readonly justUpdated?: boolean;
  readonly onClose: () => void;
  readonly onEdit: () => void;
}

export function TaskDetailsModal({
  task,
  projectName,
  isOpen,
  justUpdated = false,
  onClose,
  onEdit,
}: TaskDetailsModalProps) {
  if (!isOpen || !task) {
    return null;
  }

  const priorityLabel = formatPriority(task.priority);
  const startDateLabel = formatDisplayDate(task.startDate);
  const dueDateLabel = formatDisplayDate(task.dueDate);

  return (
    <div
      className="task-details-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-details-heading"
      data-testid="task-details-dialog"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="task-details-dialog">
        <div className="task-details-header">
          <div className="task-details-header-info">
            <span className="task-details-eyebrow">
              {projectName || 'Project'} / {task.readableId}
            </span>
            <h3 id="task-details-heading" className="task-details-title">
              Task details
            </h3>
          </div>
          <button
            type="button"
            className="task-details-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {justUpdated && (
          <div
            className="task-details-success-banner"
            role="status"
            aria-live="polite"
            data-testid="task-updated-banner"
          >
            ✓ Task updated
          </div>
        )}

        <div className="task-details-body">
          <h4 className="task-details-task-title">{task.title}</h4>
          <p className="task-details-task-desc">
            {task.description || 'No description provided.'}
          </p>

          <div className="task-details-row">
            <span>Priority: {priorityLabel}</span>
          </div>

          <div className="task-details-row">
            <span>Start date: {startDateLabel}</span>
          </div>

          <div className="task-details-row">
            <span>Due date: {dueDateLabel}</span>
          </div>
        </div>

        <div className="task-details-actions">
          <button
            type="button"
            className="task-details-btn-edit"
            data-testid="open-edit-task-btn"
            onClick={onEdit}
          >
            Edit task
          </button>
        </div>
      </div>
    </div>
  );
}

function formatPriority(priority?: TaskPriority | null): string {
  if (!priority) return 'None';
  switch (priority) {
    case TaskPriority.Low:
      return 'Low';
    case TaskPriority.Medium:
      return 'Medium';
    case TaskPriority.High:
      return 'High';
    case TaskPriority.Critical:
      return 'Critical';
    default:
      return 'None';
  }
}

function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return 'Not set';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Not set';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
