import { ColumnCategory, TaskPriority } from '../../domain/models';

export interface BacklogFilterBarProps {
  readonly search: string;
  readonly status: ColumnCategory | null;
  readonly priority: TaskPriority | 'NONE' | null;
  readonly onSearchChange: (search: string) => void;
  readonly onStatusChange: (status: ColumnCategory | null) => void;
  readonly onPriorityChange: (priority: TaskPriority | 'NONE' | null) => void;
}

export function BacklogFilterBar({
  search,
  status,
  priority,
  onSearchChange,
  onStatusChange,
  onPriorityChange,
}: BacklogFilterBarProps) {
  return (
    <div className="backlog-filter-bar" role="search" aria-label="Backlog search and filters">
      <div className="backlog-search-group">
        <label htmlFor="backlog-search-input" className="backlog-filter-label">
          Search
        </label>
        <input
          id="backlog-search-input"
          type="search"
          className="backlog-search-input"
          placeholder="Search tasks by title…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search tasks by title"
        />
      </div>

      <div className="backlog-filter-dropdowns">
        <div className="backlog-filter-group">
          <label htmlFor="backlog-status-select" className="backlog-filter-label">
            Status
          </label>
          <select
            id="backlog-status-select"
            className="backlog-filter-select"
            value={status ?? ''}
            onChange={(e) => onStatusChange(e.target.value ? (e.target.value as ColumnCategory) : null)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value={ColumnCategory.Backlog}>Backlog</option>
            <option value={ColumnCategory.ToDo}>To do</option>
            <option value={ColumnCategory.InProgress}>In progress</option>
            <option value={ColumnCategory.Done}>Done</option>
            <option value={ColumnCategory.Cancelled}>Cancelled</option>
          </select>
        </div>

        <div className="backlog-filter-group">
          <label htmlFor="backlog-priority-select" className="backlog-filter-label">
            Priority
          </label>
          <select
            id="backlog-priority-select"
            className="backlog-filter-select"
            value={priority ?? ''}
            onChange={(e) =>
              onPriorityChange(
                e.target.value
                  ? e.target.value === 'NONE'
                    ? 'NONE'
                    : (e.target.value as TaskPriority)
                  : null
              )
            }
            aria-label="Filter by priority"
          >
            <option value="">All priorities</option>
            <option value={TaskPriority.Critical}>Critical</option>
            <option value={TaskPriority.High}>High</option>
            <option value={TaskPriority.Medium}>Medium</option>
            <option value={TaskPriority.Low}>Low</option>
            <option value="NONE">No priority</option>
          </select>
        </div>
      </div>
    </div>
  );
}
