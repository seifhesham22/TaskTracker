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

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError('Title is required and cannot be empty.');
      return;
    }
    setTitleError(null);

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

        {serverError && (
          <div className="create-task-form__alert create-task-form__alert--error" role="alert">
            {serverError}
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
              className={`create-task-form__input ${titleError ? 'create-task-form__input--invalid' : ''}`}
              placeholder="e.g. Implement user authentication"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError && e.target.value.trim()) {
                  setTitleError(null);
                }
              }}
              disabled={isSubmitting}
              autoFocus
            />
            {titleError && (
              <span className="create-task-form__field-error" role="alert">
                {titleError}
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
                className="create-task-form__select"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                disabled={isSubmitting}
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.userName || member.email}
                  </option>
                ))}
              </select>
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

