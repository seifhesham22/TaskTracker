import type { BacklogItem } from '../../domain/models';
import { ColumnCategory, TaskPriority } from '../../domain/models';

export interface BacklogItemCardProps {
  readonly positionIndex: number;
  readonly item: BacklogItem;
}

function formatStatus(status: ColumnCategory): string {
  switch (status) {
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
      return 'To do';
  }
}

function formatPriority(priority?: TaskPriority | null): string {
  switch (priority) {
    case TaskPriority.Critical:
      return 'Critical';
    case TaskPriority.High:
      return 'High';
    case TaskPriority.Medium:
      return 'Medium';
    case TaskPriority.Low:
      return 'Low';
    default:
      return 'No priority';
  }
}

export function BacklogItemCard({ positionIndex, item }: BacklogItemCardProps) {
  const statusLabel = formatStatus(item.status);
  const priorityLabel = formatPriority(item.priority);
  const estimateLabel = 'Estimate: Not estimated';

  return (
    <article
      className="backlog-item-card"
      data-testid={`backlog-item-${item.id}`}
      aria-labelledby={`backlog-item-title-${item.id}`}
    >
      <div className="backlog-item-meta" data-testid={`backlog-item-meta-${item.id}`}>
        {positionIndex} · {item.readableId}
      </div>
      <h4 id={`backlog-item-title-${item.id}`} className="backlog-item-title">
        {item.title}
      </h4>
      <div className="backlog-item-details">
        <span className="backlog-item-status-priority">
          {statusLabel} · {priorityLabel} {estimateLabel}
        </span>
      </div>
    </article>
  );
}
