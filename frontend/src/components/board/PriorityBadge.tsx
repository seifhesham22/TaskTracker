import { TaskPriority } from '../../domain/models';

export interface PriorityBadgeProps {
  readonly priority: TaskPriority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const iconSrc = getPriorityIcon(priority);
  const badgeClass = `badge badge-${priority.toLowerCase()}`;

  return (
    <span className={badgeClass}>
      <img src={iconSrc} alt="" width="14" height="14" />
      <span>{priority}</span>
    </span>
  );
}

function getPriorityIcon(priority: TaskPriority): string {
  switch (priority) {
    case TaskPriority.Low:
      return '/assets/943cc.svg';
    case TaskPriority.Medium:
      return '/assets/e91f0.svg';
    case TaskPriority.High:
      return '/assets/0aa0f.svg';
    case TaskPriority.Critical:
      return '/assets/7f381.svg';
    default:
      return '/assets/943cc.svg';
  }
}
