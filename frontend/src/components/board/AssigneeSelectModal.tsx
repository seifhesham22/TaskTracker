import { useMemo, useState } from 'react';
import './AssigneeSelectModal.css';

export interface EligibleAssignee {
  readonly userId: string;
  readonly userName: string;
  readonly role?: string;
}

export interface AssigneeSelectModalProps {
  readonly isOpen: boolean;
  readonly boardName?: string | null;
  readonly selectedAssigneeId: string | 'UNASSIGNED' | null;
  readonly members: readonly EligibleAssignee[];
  readonly onApply: (assigneeId: string | 'UNASSIGNED' | null, assigneeLabel: string) => void;
  readonly onClose: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function AssigneeSelectModal({
  isOpen,
  boardName,
  selectedAssigneeId,
  members,
  onApply,
  onClose,
}: AssigneeSelectModalProps) {
  const [search, setSearch] = useState('');
  const [chosenId, setChosenId] = useState<string | 'UNASSIGNED' | null>(selectedAssigneeId);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.userName.toLowerCase().includes(q));
  }, [members, search]);

  if (!isOpen) return null;

  const handleApply = () => {
    let label = 'Anyone';
    if (chosenId === 'UNASSIGNED') {
      label = 'Unassigned';
    } else if (chosenId) {
      const match = members.find((m) => m.userId === chosenId);
      label = match?.userName || 'Member';
    }
    onApply(chosenId, label);
  };

  return (
    <div
      className="assignee-select-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assignee-select-title"
      data-testid="assignee-select-modal"
    >
      <div className="assignee-select-modal-card">
        <h3 id="assignee-select-title" className="assignee-select-modal-heading">
          Filter tasks
        </h3>
        <p className="assignee-select-modal-subheading">
          {boardName || 'Board'} · Changes apply on confirmation
        </p>

        <div className="assignee-select-form-group">
          <label htmlFor="assignee-search-input" className="assignee-select-label">
            Find an assignee
          </label>
          <div className="assignee-select-search-container">
            <input
              id="assignee-search-input"
              type="search"
              className="assignee-select-search-input"
              placeholder="Search project members…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="assignee-search-input"
              autoFocus
            />
          </div>
        </div>

        <div className="assignee-select-options-list" role="radiogroup" aria-label="Assignee choices">
          {/* Option: Anyone */}
          <button
            type="button"
            className={`assignee-option-row ${chosenId === null ? 'assignee-option-row--selected' : ''}`}
            onClick={() => setChosenId(null)}
            data-testid="assignee-opt-anyone"
            role="radio"
            aria-checked={chosenId === null}
          >
            <span className="assignee-option-avatar">—</span>
            <div className="assignee-option-info">
              <strong className="assignee-option-name">Anyone</strong>
              <span className="assignee-option-desc">All assignees</span>
            </div>
            <span className="assignee-option-radio">{chosenId === null ? '●' : '○'}</span>
          </button>

          {/* Option: Unassigned */}
          <button
            type="button"
            className={`assignee-option-row ${chosenId === 'UNASSIGNED' ? 'assignee-option-row--selected' : ''}`}
            onClick={() => setChosenId('UNASSIGNED')}
            data-testid="assignee-opt-unassigned"
            role="radio"
            aria-checked={chosenId === 'UNASSIGNED'}
          >
            <span className="assignee-option-avatar">—</span>
            <div className="assignee-option-info">
              <strong className="assignee-option-name">Unassigned</strong>
              <span className="assignee-option-desc">Tasks without an assignee</span>
            </div>
            <span className="assignee-option-radio">{chosenId === 'UNASSIGNED' ? '●' : '○'}</span>
          </button>

          {/* Options: Project Members */}
          {filteredMembers.map((member) => {
            const isSelected = chosenId === member.userId;
            return (
              <button
                key={member.userId}
                type="button"
                className={`assignee-option-row ${isSelected ? 'assignee-option-row--selected' : ''}`}
                onClick={() => setChosenId(member.userId)}
                data-testid={`assignee-opt-${member.userId}`}
                role="radio"
                aria-checked={isSelected}
              >
                <span className="assignee-option-avatar">{getInitials(member.userName)}</span>
                <div className="assignee-option-info">
                  <strong className="assignee-option-name">{member.userName}</strong>
                  <span className="assignee-option-desc">Project member</span>
                </div>
                <span className="assignee-option-radio">{isSelected ? '●' : '○'}</span>
              </button>
            );
          })}
        </div>

        <div className="assignee-select-modal-actions">
          <button
            type="button"
            className="button button-dark"
            onClick={handleApply}
            data-testid="apply-assignee-btn"
          >
            Apply assignee
          </button>
          <button
            type="button"
            className="button button-outline"
            onClick={onClose}
            data-testid="cancel-assignee-btn"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
