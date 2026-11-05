import { ColumnCategory } from '../../domain/models';

export interface DueDateLabelProps {
  readonly dueDate?: string | null;
  readonly status: ColumnCategory;
}

export function DueDateLabel({ dueDate, status }: DueDateLabelProps) {
  if (!dueDate) {
    return null;
  }

  const date = new Date(dueDate);
  if (isNaN(date.getTime())) {
    return null;
  }

  const isOverdue = checkIsOverdue(date, status);
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

  if (isOverdue) {
    return (
      <span className="date danger">
        <img src="/assets/d8aa6.svg" alt="" width="14" height="14" />
        <span>Overdue · {formattedDate}</span>
      </span>
    );
  }

  return (
    <span className="date">
      <img src="/assets/cd078.svg" alt="" width="14" height="14" />
      <span>{formattedDate}</span>
    </span>
  );
}

function checkIsOverdue(date: Date, status: ColumnCategory): boolean {
  if (status === ColumnCategory.Done) {
    return false;
  }

  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dueUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

  return dueUtc < todayUtc;
}
