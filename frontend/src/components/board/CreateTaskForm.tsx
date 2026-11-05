import { useState } from 'react';
import type { CreateTaskInput, ProjectMemberModel } from '../../domain/models';
import { TaskPriority } from '../../domain/models';
import './CreateTaskForm.css';

export interface CreateTaskFormProps {
  readonly boardId: string;
  readonly boardName?: string;
  readonly columnId?: string;
  readonly columnName?: string;
  readonly members?: readonly ProjectMemberModel[];
  readonly isOpen: boolean;
  readonly isSubmitting: boolean;
  readonly serverError?: string | null;
  readonly onClose: () => void;
  readonly onSubmit: (input: CreateTaskInput) => Promise<boolean>;
}

export function CreateTaskForm({
  boardId,
  boardName,
  columnId,
  columnName,
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
    if (trimmedTitle.length > 200) {
      setTitleError("Title can't be longer than 200 characters");
      return;
    }
    setTitleError(null);
    setDismissedAssigneeError(false);
    setDismissedGeneralError(false);

    const input: CreateTaskInput = {
      boardId,
      columnId: columnId || undefined,
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
      className="backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-task-title"
      data-testid="create-task-dialog"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="dialog">
        <button
          type="button"
          className="dialog-close"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close dialog"
        >
          <img src="/assets/b87b7.svg" alt="" width="16" height="16" />
        </button>

        <h4 id="create-task-title">New task</h4>
        <p className="dialog-desc">
          Add a task to {boardName || 'Test Board'}. It starts in <strong>{columnName || 'Backlog'}</strong>.
        </p>

        {effectiveGeneralError && (
          <div className="form-alert" role="alert" data-testid="form-general-error">
            <img src="/assets/871e4.svg" alt="" width="18" height="18" />
            <div>
              <strong>Couldn't create the task</strong>
              <p>{effectiveGeneralError}</p>
            </div>
            <button
              type="button"
              className="alert-dismiss"
              onClick={() => setDismissedGeneralError(true)}
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        <p className="required-note">
          Fields marked <b className="required-star">*</b> are required.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="task-title-input">
              Title <b className="required-star">*</b>
            </label>
            <input
              id="task-title-input"
              type="text"
              className={effectiveTitleError ? 'invalid' : ''}
              placeholder="e.g. Design the board screen"
              value={title}
              maxLength={200}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError && e.target.value.trim()) {
                  setTitleError(null);
                }
              }}
              disabled={isSubmitting}
              autoFocus
            />
            <div className="counter-row">
              {effectiveTitleError ? (
                <p className="field-error" role="alert">
                  <img src="/assets/035a3.svg" alt="" width="16" height="16" />
                  <span>{effectiveTitleError}</span>
                </p>
              ) : (
                <span />
              )}
              <span className="counter">{title.length}/200</span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="task-desc-input">Description</label>
            <textarea
              id="task-desc-input"
              rows={3}
              placeholder="Add more detail (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="task-assignee-select">Assignee</label>
            <div className="select-wrapper">
              <select
                id="task-assignee-select"
                className={`select ${effectiveAssigneeError ? 'invalid' : ''}`}
                value={assigneeId}
                onChange={(e) => {
                  setAssigneeId(e.target.value);
                  setDismissedAssigneeError(true);
                }}
                disabled={isSubmitting}
                aria-invalid={effectiveAssigneeError ? 'true' : undefined}
                aria-describedby={effectiveAssigneeError ? 'task-assignee-error' : undefined}
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.userName || member.email}
                  </option>
                ))}
              </select>
            </div>
            {effectiveAssigneeError && (
              <p id="task-assignee-error" className="field-error assignee-error" role="alert">
                <img src="/assets/035a3.svg" alt="" width="16" height="16" />
                <span>{effectiveAssigneeError}</span>
              </p>
            )}
          </div>

          <div className="field-grid">
            <div className="form-group">
              <label htmlFor="task-priority-select">Priority</label>
              <div className="select-wrapper">
                <select
                  id="task-priority-select"
                  className="select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority | '')}
                  disabled={isSubmitting}
                >
                  <option value="">No priority</option>
                  <option value={TaskPriority.Low}>Low</option>
                  <option value={TaskPriority.Medium}>Medium</option>
                  <option value={TaskPriority.High}>High</option>
                  <option value={TaskPriority.Critical}>Critical</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="task-due-date-input">Due date</label>
              <div className="due-date-wrapper">
                <img src="/assets/9ef01.svg" alt="" width="16" height="16" />
                <input
                  id="task-due-date-input"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          <div className="dialog-actions">
            <button
              type="button"
              className="button button-outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button button-dark"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
