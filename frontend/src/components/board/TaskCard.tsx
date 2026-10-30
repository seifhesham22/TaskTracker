import type { ProjectMemberModel, TaskItem } from '../../domain/models';
import './TaskCard.css';

export interface TaskCardProps {
  readonly task: TaskItem;
  readonly members?: readonly ProjectMemberModel[];
}

export function TaskCard({ task, members }: TaskCardProps) {
  const assigneeNames = getAssigneeNames(task.assigneeIds, members);
  const formattedDueDate = formatDueDate(task.dueDate);

  return (
    <article className="task-card" data-testid={`task-card-${task.id}`}>
      <div className="task-card__header">
        <span className="task-card__id">{task.readableId}</span>
        {task.priority && (
          <span className={`task-card__badge task-card__badge--${task.priority.toLowerCase()}`}>
            {task.priority}
          </span>
        )}
      </div>

      <h3 className="task-card__title">{task.title}</h3>

      {task.description && (
        <p className="task-card__description">{task.description}</p>
      )}

      {(assigneeNames || formattedDueDate) && (
        <div className="task-card__footer">
          {assigneeNames && (
            <span className="task-card__meta-item" title="Assignee" aria-label={`Assignee: ${assigneeNames}`}>
              👤 {assigneeNames}
            </span>
          )}

          {formattedDueDate && (
            <span className="task-card__meta-item" title="Due date" aria-label={`Due date: ${formattedDueDate}`}>
              📅 {formattedDueDate}
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

function formatDueDate(isoString?: string | null): string | null {
  if (!isoString) {
    return null;
  }

  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return null;
  }
}
