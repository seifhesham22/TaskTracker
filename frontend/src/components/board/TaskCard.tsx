import type { ProjectMemberModel, TaskItem } from '../../domain/models';
import { PriorityBadge } from './PriorityBadge';
import { DueDateLabel } from './DueDateLabel';
import './TaskCard.css';

export interface TaskCardProps {
  readonly task: TaskItem;
  readonly members?: readonly ProjectMemberModel[];
}

export function TaskCard({ task, members }: TaskCardProps) {
  const assigneeNames = getAssigneeNames(task.assigneeIds, members);
  const initials = getInitials(assigneeNames);
  const hasMeta = Boolean(task.priority || task.dueDate || assigneeNames);

  return (
    <article
      className="card"
      data-testid={`task-card-${task.id}`}
      tabIndex={0}
      role="button"
      aria-label={`Task ${task.readableId}: ${task.title}`}
    >
      <strong>{task.title}</strong>

      {hasMeta && (
        <div className="card-meta">
          {task.priority && <PriorityBadge priority={task.priority} />}
          {task.dueDate && <DueDateLabel dueDate={task.dueDate} status={task.status} />}
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

function getAssigneeNames(
  assigneeIds: readonly string[],
  members?: readonly ProjectMemberModel[]
): string | null {
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
