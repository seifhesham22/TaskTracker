import { useState } from 'react';
import type { WorkloadTaskItem } from '../../domain/models';
import { ColumnCategory, TaskPriority } from '../../domain/models';

export interface WorkloadDrillDownViewProps {
  readonly title: string;
  readonly projectName: string;
  readonly tasks: readonly WorkloadTaskItem[];
  readonly onBack: () => void;
  readonly pageSize?: number;
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

export function WorkloadDrillDownView({
  title,
  projectName,
  tasks,
  onBack,
  pageSize = 5,
}: WorkloadDrillDownViewProps) {
  const [displayLimit, setDisplayLimit] = useState(pageSize);

  const displayedTasks = tasks.slice(0, displayLimit);
  const totalCount = tasks.length;
  const hasMore = displayLimit < totalCount;

  const handleLoadMore = () => {
    setDisplayLimit((prev) => prev + pageSize);
  };

  return (
    <div className="workload-drilldown-container" data-testid="workload-drilldown-view">
      <header className="workload-drilldown-header">
        <h3 className="workload-card-title">{title}</h3>
        <p className="workload-card-subtitle">
          {projectName} · {totalCount} {totalCount === 1 ? 'open task' : 'open tasks'}
        </p>
      </header>

      <div className="workload-drilldown-list" role="list" aria-label={title}>
        {displayedTasks.map((task) => {
          const statusText = formatStatus(task.status);
          const priorityText = formatPriority(task.priority);

          return (
            <article
              key={task.id}
              className="workload-task-card"
              data-testid={`workload-task-card-${task.id}`}
            >
              <h4 className="workload-task-title">{task.title}</h4>
              <p className="workload-task-meta">
                {task.readableId} · {statusText} · {priorityText}
              </p>
            </article>
          );
        })}
      </div>

      <div className="workload-showing-box" data-testid="workload-showing-box">
        Showing {displayedTasks.length} of {totalCount} open tasks
      </div>

      {hasMore && (
        <button
          type="button"
          className="workload-btn-secondary"
          data-testid="workload-load-more-btn"
          onClick={handleLoadMore}
        >
          Load more
        </button>
      )}

      <button
        type="button"
        className="workload-btn-secondary"
        data-testid="workload-back-btn"
        onClick={onBack}
      >
        Back to workload
      </button>
    </div>
  );
}
