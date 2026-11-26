import { useState } from 'react';
import { ColumnCategory, TaskPriority } from '../../domain/models';
import { AssigneeSelectModal, type EligibleAssignee } from './AssigneeSelectModal';
import './FilterTasksModal.css';

export interface FilterTasksModalProps {
  readonly isOpen: boolean;
  readonly boardName?: string | null;
  readonly initialStatus: ColumnCategory | null;
  readonly initialPriority: TaskPriority | 'NONE' | null;
  readonly initialAssigneeId: string | 'UNASSIGNED' | null;
  readonly initialAssigneeName?: string | null;
  readonly members: readonly EligibleAssignee[];
  readonly onApply: (
    status: ColumnCategory | null,
    priority: TaskPriority | 'NONE' | null,
    assigneeId: string | 'UNASSIGNED' | null,
    assigneeName?: string | null
  ) => void;
  readonly onReset: () => void;
  readonly onClose: () => void;
}

export function FilterTasksModal({
  isOpen,
  boardName,
  initialStatus,
  initialPriority,
  initialAssigneeId,
  initialAssigneeName,
  members,
  onApply,
  onReset,
  onClose,
}: FilterTasksModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<ColumnCategory | null>(initialStatus);
  const [selectedPriority, setSelectedPriority] = useState<TaskPriority | 'NONE' | null>(initialPriority);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | 'UNASSIGNED' | null>(
    initialAssigneeId
  );
  const [selectedAssigneeName, setSelectedAssigneeName] = useState<string | null>(
    initialAssigneeName ||
      (initialAssigneeId === 'UNASSIGNED'
        ? 'Unassigned'
        : initialAssigneeId
          ? members.find((m) => m.userId === initialAssigneeId)?.userName || 'Member'
          : 'Anyone')
  );

  const [isAssigneePickerOpen, setIsAssigneePickerOpen] = useState(false);

  if (!isOpen) return null;

  const handleApply = () => {
    onApply(selectedStatus, selectedPriority, selectedAssigneeId, selectedAssigneeName);
    onClose();
  };

  const handleReset = () => {
    setSelectedStatus(null);
    setSelectedPriority(null);
    setSelectedAssigneeId(null);
    setSelectedAssigneeName('Anyone');
    onReset();
    onClose();
  };

  return (
    <>
      <div
        className="filter-tasks-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-tasks-title"
        data-testid="filter-tasks-modal"
      >
        <div className="filter-tasks-modal-card">
          <h3 id="filter-tasks-title" className="filter-tasks-modal-heading">
            Filter tasks
          </h3>
          <p className="filter-tasks-modal-subheading">
            {boardName || 'Board'} · Changes apply on confirmation
          </p>

          {/* Status field */}
          <div className="filter-form-group">
            <label htmlFor="filter-status-select" className="filter-label">
              Status
            </label>
            <div className="filter-select-container">
              <select
                id="filter-status-select"
                className="filter-select"
                value={selectedStatus ?? ''}
                onChange={(e) =>
                  setSelectedStatus(e.target.value ? (e.target.value as ColumnCategory) : null)
                }
                data-testid="filter-status-select"
              >
                <option value="">All statuses</option>
                <option value={ColumnCategory.Backlog}>Backlog</option>
                <option value={ColumnCategory.ToDo}>To do</option>
                <option value={ColumnCategory.InProgress}>In progress</option>
                <option value={ColumnCategory.Done}>Done</option>
                <option value={ColumnCategory.Cancelled}>Cancelled</option>
              </select>
            </div>
          </div>

          {/* Assignee field */}
          <div className="filter-form-group">
            <label className="filter-label" id="filter-assignee-label">
              Assignee
            </label>
            <button
              type="button"
              className="filter-assignee-trigger"
              onClick={() => setIsAssigneePickerOpen(true)}
              aria-labelledby="filter-assignee-label"
              data-testid="filter-assignee-trigger"
            >
              <span>{selectedAssigneeName || 'Anyone'}</span>
              <span className="filter-dropdown-icon">⌄</span>
            </button>
          </div>

          {/* Priority field */}
          <div className="filter-form-group">
            <label htmlFor="filter-priority-select" className="filter-label">
              Priority
            </label>
            <div className="filter-select-container">
              <select
                id="filter-priority-select"
                className="filter-select"
                value={selectedPriority ?? ''}
                onChange={(e) =>
                  setSelectedPriority(
                    e.target.value
                      ? e.target.value === 'NONE'
                        ? 'NONE'
                        : (e.target.value as TaskPriority)
                      : null
                  )
                }
                data-testid="filter-priority-select"
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

          {/* Actions */}
          <div className="filter-tasks-modal-actions">
            <button
              type="button"
              className="button button-dark"
              onClick={handleApply}
              data-testid="apply-filters-btn"
            >
              Apply filters
            </button>
            <button
              type="button"
              className="button button-outline"
              onClick={handleReset}
              data-testid="reset-filters-btn"
            >
              Reset filters
            </button>
            <button
              type="button"
              className="button button-outline"
              onClick={onClose}
              data-testid="cancel-filters-btn"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Sub-picker for Assignee */}
      {isAssigneePickerOpen && (
        <AssigneeSelectModal
          isOpen={isAssigneePickerOpen}
          boardName={boardName}
          selectedAssigneeId={selectedAssigneeId}
          members={members}
          onApply={(assigneeId, assigneeLabel) => {
            setSelectedAssigneeId(assigneeId);
            setSelectedAssigneeName(assigneeLabel);
            setIsAssigneePickerOpen(false);
          }}
          onClose={() => setIsAssigneePickerOpen(false)}
        />
      )}
    </>
  );
}
