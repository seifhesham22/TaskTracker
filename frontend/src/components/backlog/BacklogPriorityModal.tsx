import { useEffect, useState, type FormEvent } from 'react';
import type { BacklogItem } from '../../domain/models';
import { TaskPriority } from '../../domain/models';
import './BacklogPriorityModal.css';

export interface BacklogPriorityModalProps {
  readonly isOpen: boolean;
  readonly item: BacklogItem | null;
  readonly onClose: () => void;
  readonly onSubmit: (priority: TaskPriority | null) => void;
}

interface PriorityOption {
  readonly value: TaskPriority | null;
  readonly label: string;
  readonly color: string;
}

const PRIORITY_OPTIONS: readonly PriorityOption[] = [
  { value: null, label: 'No priority', color: '#8A90A0' },
  { value: TaskPriority.Low, label: 'Low', color: '#16A34A' },
  { value: TaskPriority.Medium, label: 'Medium', color: '#CA8A04' },
  { value: TaskPriority.High, label: 'High', color: '#EA580C' },
  { value: TaskPriority.Critical, label: 'Critical', color: '#DC2626' },
];

export function BacklogPriorityModal({
  isOpen,
  item,
  onClose,
  onSubmit,
}: BacklogPriorityModalProps) {
  if (!isOpen || !item) {
    return null;
  }

  return (
    <BacklogPriorityModalContent
      item={item}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

interface BacklogPriorityModalContentProps {
  readonly item: BacklogItem;
  readonly onClose: () => void;
  readonly onSubmit: (priority: TaskPriority | null) => void;
}

function BacklogPriorityModalContent({
  item,
  onClose,
  onSubmit,
}: BacklogPriorityModalContentProps) {
  const [selectedPriority, setSelectedPriority] = useState<TaskPriority | null>(
    item.priority ?? null
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(selectedPriority);
    onClose();
  };

  const initialPriority = item.priority ?? null;
  const isUnchanged = selectedPriority === initialPriority;

  return (
    <div
      className="backlog-modal-backdrop"
      data-testid="backlog-priority-modal"
      onClick={onClose}
    >
      <div
        className="backlog-modal-dialog backlog-priority-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backlog-priority-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="backlog-modal-header">
          <h3 id="backlog-priority-title" className="backlog-modal-title">
            Change item priority
          </h3>
          <p className="backlog-modal-subtitle">
            Set priority for {item.readableId}.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="backlog-priority-form">
          <div className="backlog-priority-options" role="radiogroup" aria-label="Task priority">
            {PRIORITY_OPTIONS.map((opt) => {
              const isSelected = selectedPriority === opt.value;
              const inputId = `priority-opt-${opt.value ?? 'none'}`;
              return (
                <label
                  key={opt.value ?? 'none'}
                  htmlFor={inputId}
                  className={`backlog-priority-option ${isSelected ? 'backlog-priority-option-selected' : ''}`}
                  data-testid={`backlog-priority-option-${opt.value ?? 'none'}`}
                >
                  <input
                    type="radio"
                    id={inputId}
                    name="task-priority"
                    value={opt.value ?? ''}
                    checked={isSelected}
                    onChange={() => setSelectedPriority(opt.value)}
                    className="backlog-priority-radio"
                  />
                  <span
                    className="backlog-priority-indicator"
                    style={{ backgroundColor: opt.color }}
                    aria-hidden="true"
                  />
                  <span className="backlog-priority-label">{opt.label}</span>
                  {isSelected && (
                    <span className="backlog-priority-check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          <div className="backlog-modal-actions">
            <button
              type="button"
              className="backlog-btn-secondary"
              data-testid="backlog-priority-cancel-btn"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="backlog-btn-primary"
              data-testid="backlog-priority-submit-btn"
              disabled={isUnchanged}
            >
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
