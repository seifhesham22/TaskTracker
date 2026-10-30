import { useState } from 'react';
import type { CreateTaskInput, ProjectMemberModel } from '../../domain/models';
import { TaskPriority } from '../../domain/models';
import './CreateTaskForm.css';

export interface CreateTaskFormProps {
  readonly boardId: string;
  readonly members?: readonly ProjectMemberModel[];
  readonly isOpen: boolean;
  readonly isSubmitting: boolean;
  readonly serverError?: string | null;
  readonly onClose: () => void;
  readonly onSubmit: (input: CreateTaskInput) => Promise<boolean>;
}

export function CreateTaskForm({
  boardId,
  members = [],
  isOpen,
  isSubmitting,
  serverError,
  onClose,
  onSubmit,
}: CreateTaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [dueDate, setDueDate] = useState('');

  const [titleError, setTitleError] = useState<string | null>(null);
  const [dismissedAssigneeError, setDismissedAssigneeError] = useState(false);
  const [dismissedGeneralError, setDismissedGeneralError] = useState(false);

  // Derive field-specific or general server errors dynamically without setState in effect
  let serverAssigneeError: string | null = null;
  let serverGeneralError: string | null = null;
  let serverTitleError: string | null = null;

  if (serverError) {
    const lower = serverError.toLowerCase();

    if (lower.includes('board') && lower.includes('not found')) {
      serverGeneralError = 'Board not found';
    } else if (
      lower.includes('assignee') ||
      lower.includes('member') ||
      lower.includes("can't be assigned") ||
      lower.includes('cannot be assigned')
    ) {
      serverAssigneeError = serverError;
    } else if (lower.includes('title')) {
      serverTitleError = serverError;
    } else {
      serverGeneralError = serverError;
    }
  }

  const effectiveTitleError = titleError || serverTitleError;
  const effectiveAssigneeError = dismissedAssigneeError ? null : serverAssigneeError;
  const effectiveGeneralError = dismissedGeneralError ? null : serverGeneralError;

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError('Title is required');
      return;
    }
    setTitleError(null);
    setDismissedAssigneeError(false);
    setDismissedGeneralError(false);

    const input: CreateTaskInput = {
      boardId,
      title: trimmedTitle,
      description: description.trim() ? description.trim() : undefined,
      assigneeId: assigneeId ? assigneeId : undefined,
      priority: priority ? (priority as TaskPriority) : undefined,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
    };

    const success = await onSubmit(input);
    if (success) {
      setTitle('');
      setDescription('');
      setAssigneeId('');
      setPriority('');
      setDueDate('');
      setTitleError(null);
      setDismissedAssigneeError(false);
      setDismissedGeneralError(false);
      onClose();
    }
  };

  return (
    <div
      className="create-task-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-task-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="create-task-form">
        <div className="create-task-form__header">
          <h2 id="create-task-title" className="create-task-form__title">
            Create Task
          </h2>
          <button
            type="button"
            className="create-task-form__close-btn"
            onClick={onClose}
            aria-label="Close modal"
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        {effectiveGeneralError && (
          <div className="create-task-form__alert create-task-form__alert--error" role="alert">
            {effectiveGeneralError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="create-task-form__group">
            <label htmlFor="task-title-input" className="create-task-form__label">
              Title <span className="create-task-form__required">*</span>
            </label>
            <input
              id="task-title-input"
              type="text"
              className={`create-task-form__input ${effectiveTitleError ? 'create-task-form__input--invalid' : ''}`}
              placeholder="e.g. Implement user authentication"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                // "An error disappears as soon as the field is fixed."
                if (titleError && e.target.value.trim()) {
                  setTitleError(null);
                }
              }}
              disabled={isSubmitting}
              autoFocus
            />
            {effectiveTitleError && (
              <span className="create-task-form__field-error" role="alert">
                {effectiveTitleError}
              </span>
            )}
          </div>

          <div className="create-task-form__group" style={{ marginTop: 'var(--space-3)' }}>
            <label htmlFor="task-desc-input" className="create-task-form__label">
              Description
            </label>
            <textarea
              id="task-desc-input"
              rows={3}
              className="create-task-form__textarea"
              placeholder="Optional task details or acceptance criteria"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="create-task-form__row" style={{ marginTop: 'var(--space-3)' }}>
            <div className="create-task-form__group">
              <label htmlFor="task-assignee-select" className="create-task-form__label">
                Assignee
              </label>
              <select
                id="task-assignee-select"
                className={`create-task-form__select ${effectiveAssigneeError ? 'create-task-form__input--invalid' : ''}`}
                value={assigneeId}
                onChange={(e) => {
                  setAssigneeId(e.target.value);
                  // "An error disappears as soon as the field is fixed."
                  setDismissedAssigneeError(true);
                }}
                disabled={isSubmitting}
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.userName || member.email}
                  </option>
                ))}
              </select>
              {effectiveAssigneeError && (
                <span className="create-task-form__field-error" role="alert">
                  {effectiveAssigneeError}
                </span>
              )}
            </div>

            <div className="create-task-form__group">
              <label htmlFor="task-priority-select" className="create-task-form__label">
                Priority
              </label>
              <select
                id="task-priority-select"
                className="create-task-form__select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority | '')}
                disabled={isSubmitting}
              >
                <option value="">None</option>
                <option value={TaskPriority.Low}>Low</option>
                <option value={TaskPriority.Medium}>Medium</option>
                <option value={TaskPriority.High}>High</option>
                <option value={TaskPriority.Critical}>Critical</option>
              </select>
            </div>
          </div>

          <div className="create-task-form__group" style={{ marginTop: 'var(--space-3)' }}>
            <label htmlFor="task-due-date-input" className="create-task-form__label">
              Due Date
            </label>
            <input
              id="task-due-date-input"
              type="date"
              className="create-task-form__input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="create-task-form__actions">
            <button
              type="button"
              className="create-task-form__btn create-task-form__btn--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="create-task-form__btn create-task-form__btn--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
