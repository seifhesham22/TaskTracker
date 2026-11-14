import type { ProjectMemberModel, TaskItem } from '../../domain/models';
import { PriorityBadge } from './PriorityBadge';
import { DueDateLabel } from './DueDateLabel';
import './TaskCard.css';

export interface TaskCardProps {
  readonly task: TaskItem;
  readonly members?: readonly ProjectMemberModel[];
  readonly isSaving?: boolean;
  readonly subtaskCount?: number;
  readonly onSelect?: (task: TaskItem) => void;
}

export function TaskCard({ task, members, isSaving, subtaskCount, onSelect }: TaskCardProps) {
  const assigneeNames = getAssigneeName(task, members);
  const initials = getInitials(assigneeNames);
  const isSubtask = Boolean(task.parentTaskId);
  const hasMeta = Boolean(
    task.priority ||
      task.dueDate ||
      assigneeNames ||
      isSaving ||
      (subtaskCount !== undefined && subtaskCount > 0)
  );

  const handleDragStart = (e: React.DragEvent) => {
    if (isSaving) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.setData('application/x-task-id', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) {
      return;
    }
    onSelect?.(task);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect?.(task);
    }
  };

  return (
    <article
      className={`card ${isSaving ? 'is-saving' : ''} ${isSubtask ? 'card--subtask' : ''}`}
      data-testid={`task-card-${task.id}`}
      tabIndex={0}
      role="button"
      aria-label={`${isSubtask ? 'Subtask' : 'Task'} ${task.readableId}: ${task.title}`}
      aria-busy={isSaving ? 'true' : undefined}
      draggable={!isSaving}
      onDragStart={handleDragStart}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="card-header-row">
        <span className="card-readable-id">{task.readableId}</span>
        {isSubtask && (
          <span
            className="card-subtask-badge"
            data-testid={`subtask-badge-${task.id}`}
            aria-label="Subtask"
          >
            <span className="card-subtask-icon">↳</span> Subtask
          </span>
        )}
        {onSelect && (
          <button
            type="button"
            className="card-details-button"
            aria-label={`View details for ${task.readableId}`}
            data-testid={`open-task-${task.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(task);
            }}
          >
            Details
          </button>
        )}
      </div>

      <strong>{task.title}</strong>

      {hasMeta && (
        <div className="card-meta">
          {task.priority && <PriorityBadge priority={task.priority} />}
          {task.dueDate && <DueDateLabel dueDate={task.dueDate} status={task.status} />}
          {subtaskCount !== undefined && subtaskCount > 0 && (
            <span
              className="card-subtasks-count"
              data-testid={`subtasks-count-${task.id}`}
              title={`${subtaskCount} subtasks`}
            >
              ▤ {subtaskCount} {subtaskCount === 1 ? 'subtask' : 'subtasks'}
            </span>
          )}
          {isSaving && (
            <span className="card-saving-badge" role="status" aria-live="polite">
              Saving...
            </span>
          )}
          {assigneeNames && (
            <span
              className="avatar avatar-small"
              title={`Assignee: ${assigneeNames}`}
              aria-label={`Assignee: ${assigneeNames}`}
            >
              {initials}
              <span className="visually-hidden">{assigneeNames}</span>
            </span>
          )}
        </div>
      )}
    </article>
  );
}

function getAssigneeName(
  task: TaskItem,
  members?: readonly ProjectMemberModel[]
): string | null {
  if (task.assigneeNames && task.assigneeNames.length > 0 && task.assigneeNames[0]) {
    return task.assigneeNames.join(', ');
  }

  if (task.assignees && task.assignees.length > 0) {
    const validNames = task.assignees.map((a) => a.userName).filter(Boolean);
    if (validNames.length > 0) {
      return validNames.join(', ');
    }
  }

  const assigneeIds = task.assigneeIds;
  if (!assigneeIds || assigneeIds.length === 0) {
    return null;
  }

  if (!members || members.length === 0) {
    return assigneeIds.length === 1 ? 'Assigned' : `${assigneeIds.length} assignees`;
  }

  const names = assigneeIds
    .map((id) => members.find((m) => m.userId === id)?.userName || members.find((m) => m.userId === id)?.email)
    .filter((name): name is string => Boolean(name));

  if (names.length === 0) {
    return null;
  }

  return names.join(', ');
}

function getInitials(name: string | null): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
