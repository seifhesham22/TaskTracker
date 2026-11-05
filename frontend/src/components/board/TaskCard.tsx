import type { ProjectMemberModel, TaskItem } from '../../domain/models';
import { PriorityBadge } from './PriorityBadge';
import { DueDateLabel } from './DueDateLabel';
import './TaskCard.css';

export interface TaskCardProps {
  readonly task: TaskItem;
  readonly members?: readonly ProjectMemberModel[];
  readonly isSaving?: boolean;
}

export function TaskCard({ task, members, isSaving }: TaskCardProps) {
  const assigneeNames = getAssigneeName(task, members);
  const initials = getInitials(assigneeNames);
  const hasMeta = Boolean(task.priority || task.dueDate || assigneeNames || isSaving);

  const handleDragStart = (e: React.DragEvent) => {
    if (isSaving) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.setData('application/x-task-id', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <article
      className={`card ${isSaving ? 'is-saving' : ''}`}
      data-testid={`task-card-${task.id}`}
      tabIndex={0}
      role="button"
      aria-label={`Task ${task.readableId}: ${task.title}`}
      aria-busy={isSaving ? 'true' : undefined}
      draggable={!isSaving}
      onDragStart={handleDragStart}
    >
      <strong>{task.title}</strong>

      {hasMeta && (
        <div className="card-meta">
          {task.priority && <PriorityBadge priority={task.priority} />}
          {task.dueDate && <DueDateLabel dueDate={task.dueDate} status={task.status} />}
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
  if (!name) return 'AD';
  const clean = name.replace(/@.*/, '').trim();
  const parts = clean.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}
