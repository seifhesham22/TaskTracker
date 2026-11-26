import { useMemo, useState } from 'react';
import { ColumnCategory, TaskPriority } from '../../domain/models';
import type { EligibleAssignee } from './AssigneeSelectModal';
import { FilterTasksModal } from './FilterTasksModal';
import './BoardFilterBar.css';

export interface BoardFilterBarProps {
  readonly boardName?: string | null;
  readonly search: string;
  readonly statusFilter: ColumnCategory | null;
  readonly priorityFilter: TaskPriority | 'NONE' | null;
  readonly assigneeFilter: string | 'UNASSIGNED' | null;
  readonly assigneeName: string | null;
  readonly isFilterLoading: boolean;
  readonly filterError: string | null;
  readonly totalPermittedCount: number;
  readonly matchingCount: number;
  readonly hasActiveFilters: boolean;
  readonly activeFilterCount: number;
  readonly members: readonly EligibleAssignee[];
  readonly onSearchChange: (query: string) => void;
  readonly onApplyFilters: (
    status: ColumnCategory | null,
    priority: TaskPriority | 'NONE' | null,
    assigneeId: string | 'UNASSIGNED' | null,
    assigneeName?: string | null
  ) => void;
  readonly onClearAll: () => void;
  readonly onRemoveFilter: (kind: 'search' | 'status' | 'priority' | 'assignee') => void;
  readonly onRetry: () => void;
}

function getStatusLabel(status: ColumnCategory): string {
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
      return status;
  }
}

function getPriorityLabel(priority: TaskPriority | 'NONE'): string {
  switch (priority) {
    case TaskPriority.Critical:
      return 'Critical';
    case TaskPriority.High:
      return 'High';
    case TaskPriority.Medium:
      return 'Medium';
    case TaskPriority.Low:
      return 'Low';
    case 'NONE':
      return 'No priority';
    default:
      return priority;
  }
}

export function BoardFilterBar({
  boardName,
  search,
  statusFilter,
  priorityFilter,
  assigneeFilter,
  assigneeName,
  isFilterLoading,
  filterError,
  totalPermittedCount,
  matchingCount,
  hasActiveFilters,
  activeFilterCount,
  members,
  onSearchChange,
  onApplyFilters,
  onClearAll,
  onRemoveFilter,
  onRetry,
}: BoardFilterBarProps) {
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (search.trim()) {
      parts.push(`Title contains “${search.trim()}”`);
    }
    if (activeFilterCount > 0) {
      parts.push(`${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'}`);
    }
    return parts.join(' · ');
  }, [search, activeFilterCount]);

  return (
    <div className="board-filter-bar" role="search" aria-label="Search and filter tasks">
      {/* Search Input & Filter Button Row */}
      <div className="board-filter-bar__top-row">
        <div className="board-filter-bar__search-group">
          <label htmlFor="board-search-input" className="board-filter-bar__label">
            Search tasks
          </label>
          <div className="board-filter-bar__input-wrapper">
            <input
              id="board-search-input"
              type="search"
              className="board-filter-bar__input"
              placeholder="Search by title…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              data-testid="board-search-input"
              aria-label="Search tasks"
            />
          </div>
        </div>

        <button
          type="button"
          className="button button-outline board-filter-bar__filters-btn"
          onClick={() => setIsFilterModalOpen(true)}
          data-testid="board-filter-btn"
        >
          {activeFilterCount > 0 ? `Filters · ${activeFilterCount}` : 'Filters'}
        </button>
      </div>

      {/* State 05: Active Filter Chips */}
      {hasActiveFilters && (
        <div className="board-filter-bar__active-chips-section" data-testid="active-filter-chips">
          <div className="board-filter-bar__chips-row">
            {statusFilter && (
              <button
                type="button"
                className="board-filter-chip"
                onClick={() => onRemoveFilter('status')}
                data-testid="status-filter-chip"
                aria-label={`Remove status filter ${getStatusLabel(statusFilter)}`}
              >
                <span>{getStatusLabel(statusFilter)} ×</span>
              </button>
            )}

            {assigneeFilter && (
              <button
                type="button"
                className="board-filter-chip"
                onClick={() => onRemoveFilter('assignee')}
                data-testid="assignee-filter-chip"
                aria-label={`Remove assignee filter ${assigneeName || 'Assignee'}`}
              >
                <span>{assigneeName || 'Assignee'} ×</span>
              </button>
            )}

            {priorityFilter && (
              <button
                type="button"
                className="board-filter-chip"
                onClick={() => onRemoveFilter('priority')}
                data-testid="priority-filter-chip"
                aria-label={`Remove priority filter ${getPriorityLabel(priorityFilter)}`}
              >
                <span>{getPriorityLabel(priorityFilter)} ×</span>
              </button>
            )}
          </div>

          <div className="board-filter-bar__summary-row">
            {filterSummary && (
              <p className="board-filter-bar__summary-text" data-testid="filter-summary-text">
                {filterSummary}
              </p>
            )}
            <button
              type="button"
              className="button button-outline board-filter-bar__clear-btn"
              onClick={onClearAll}
              data-testid="clear-all-filters-btn"
            >
              Clear all
            </button>
          </div>
        </div>
      )}

      {/* State 07: Matching results loading */}
      {isFilterLoading && (
        <div
          className="board-filter-bar__loading-banner"
          role="status"
          aria-live="polite"
          data-testid="filter-loading-banner"
        >
          <span className="board-filter-bar__status-text">Loading matching tasks…</span>
          <div className="board-filter-bar__skeletons" aria-hidden="true">
            <div className="board-filter-skeleton-card" />
            <div className="board-filter-skeleton-card" />
          </div>
        </div>
      )}

      {/* State 08: Request failed */}
      {!isFilterLoading && filterError && (
        <div
          className="board-filter-bar__error-banner"
          role="alert"
          data-testid="filter-error-banner"
        >
          <span className="board-filter-bar__error-text">{filterError}</span>
          <button
            type="button"
            className="button button-outline board-filter-bar__retry-btn"
            onClick={onRetry}
            data-testid="filter-retry-btn"
          >
            Try again
          </button>
        </div>
      )}

      {/* State 06: Zero matching results */}
      {!isFilterLoading && !filterError && hasActiveFilters && matchingCount === 0 && (
        <div
          className="board-filter-bar__empty-banner"
          data-testid="no-matching-tasks-msg"
        >
          <span className="board-filter-bar__status-text">No tasks match your search and filters.</span>
          <button
            type="button"
            className="button button-outline board-filter-bar__adjust-btn"
            onClick={() => setIsFilterModalOpen(true)}
            data-testid="adjust-filters-btn"
          >
            Adjust filters
          </button>
        </div>
      )}

      {/* State 04 & 05: Matching results count */}
      {!isFilterLoading && !filterError && hasActiveFilters && matchingCount > 0 && (
        <div className="board-filter-bar__count-banner" data-testid="matching-tasks-count">
          <span className="board-filter-bar__status-text">
            {matchingCount} matching task{matchingCount === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {/* State 01 & 09: Permitted board tasks count */}
      {!isFilterLoading && !filterError && !hasActiveFilters && (
        <div className="board-filter-bar__count-banner" data-testid="permitted-tasks-count">
          <span className="board-filter-bar__status-text">
            {matchingCount || totalPermittedCount} tasks · Permitted board tasks
          </span>
        </div>
      )}

      {/* Filter Modal */}
      {isFilterModalOpen && (
        <FilterTasksModal
          isOpen={isFilterModalOpen}
          boardName={boardName}
          initialStatus={statusFilter}
          initialPriority={priorityFilter}
          initialAssigneeId={assigneeFilter}
          initialAssigneeName={assigneeName}
          members={members}
          onApply={onApplyFilters}
          onReset={onClearAll}
          onClose={() => setIsFilterModalOpen(false)}
        />
      )}
    </div>
  );
}
