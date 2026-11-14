import { useState } from 'react';
import type { TaskItem, UpdateTaskInput } from '../../domain/models';
import { TaskPriority } from '../../domain/models';
import { taskEditorValidator } from '../../domain/validators/TaskEditorValidator';
import { DiscardChangesDialog } from './DiscardChangesDialog';
import './EditTaskModal.css';

export interface EditTaskModalProps {
  readonly task: TaskItem | null;
  readonly projectName?: string | null;
  readonly isOpen: boolean;
  readonly isLoading?: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (input: UpdateTaskInput) => Promise<TaskItem | boolean>;
  readonly onSuccess?: (updatedTask: TaskItem) => void;
}

export function EditTaskModal({
  task,
  projectName,
  isOpen,
  isLoading = false,
  onClose,
  onSubmit,
  onSuccess,
}: EditTaskModalProps) {
  if (!isOpen || !task) {
    return null;
  }

  return (
    <EditTaskFormContent
      key={`${task.id}-${isOpen}`}
      task={task}
      projectName={projectName}
      isLoading={isLoading}
      onClose={onClose}
      onSubmit={onSubmit}
      onSuccess={onSuccess}
    />
  );
}

interface EditTaskFormContentProps {
  readonly task: TaskItem;
  readonly projectName?: string | null;
  readonly isLoading: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (input: UpdateTaskInput) => Promise<TaskItem | boolean>;
  readonly onSuccess?: (updatedTask: TaskItem) => void;
}

function EditTaskFormContent({
  task,
  projectName,
  isLoading,
  onClose,
  onSubmit,
  onSuccess,
}: EditTaskFormContentProps) {
  const [title, setTitle] = useState(task.title || '');
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState<TaskPriority | ''>(task.priority || '');
  const [startDate, setStartDate] = useState(toInputDateFormat(task.startDate));
  const [dueDate, setDueDate] = useState(toInputDateFormat(task.dueDate));

  const [fieldErrors, setFieldErrors] = useState<{ title?: string; dueDate?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const initialTitle = task.title || '';
  const initialDescription = task.description || '';
  const initialPriority = task.priority || '';
  const initialStartDate = toInputDateFormat(task.startDate);
  const initialDueDate = toInputDateFormat(task.dueDate);

  const isDirty =
    title !== initialTitle ||
    description !== initialDescription ||
    priority !== initialPriority ||
    startDate !== initialStartDate ||
    dueDate !== initialDueDate;

  const handleAttemptClose = () => {
    if (isSubmitting) return;
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate using TaskEditorValidator
    const validation = taskEditorValidator.validate({
      title,
      description,
      priority: priority ? (priority as TaskPriority) : null,
      startDate: startDate || null,
      dueDate: dueDate || null,
    });

    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      return;
    }

    setFieldErrors({});
    setServerError(null);
    setIsSubmitting(true);

    const updateInput: UpdateTaskInput = {
      taskId: task.id,
      title: title.trim(),
      description: description.trim() ? description.trim() : null,
      priority: priority ? (priority as TaskPriority) : null,
      startDate: fromInputDateFormat(startDate),
      dueDate: fromInputDateFormat(dueDate),
    };

    try {
      const result = await onSubmit(updateInput);
      if (result) {
        if (typeof result === 'object' && onSuccess) {
          onSuccess(result);
        }
        onClose();
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'We couldn’t save your changes. Try again.';
      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div
        className="edit-task-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-task-title-heading"
        data-testid="edit-task-dialog"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            handleAttemptClose();
          }
        }}
      >
        <div className="edit-task-dialog">
          <div className="edit-task-header">
            <div className="edit-task-header-info">
              <span className="edit-task-eyebrow">
                {projectName || 'Project'} / {task.readableId}
              </span>
              <h3 id="edit-task-title-heading" className="edit-task-title">
                Edit task
              </h3>
            </div>
            <button
              type="button"
              className="edit-task-close"
              aria-label="Close"
              onClick={handleAttemptClose}
              disabled={isSubmitting}
            >
              ×
            </button>
          </div>

          {serverError && (
            <div
              className="edit-task-error-banner"
              role="alert"
              data-testid="edit-task-server-error"
            >
              {serverError}
            </div>
          )}

          {isLoading ? (
            <div className="edit-task-form" aria-busy="true" aria-label="Loading task details">
              <div className="edit-task-skeleton edit-task-skeleton-label" />
              <div className="edit-task-skeleton edit-task-skeleton-input" />
              <div className="edit-task-skeleton edit-task-skeleton-label" />
              <div className="edit-task-skeleton edit-task-skeleton-textarea" />
              <div className="edit-task-skeleton edit-task-skeleton-label" />
              <div className="edit-task-skeleton edit-task-skeleton-input" />
              <div className="edit-task-skeleton edit-task-skeleton-label" />
              <div className="edit-task-skeleton edit-task-skeleton-input" />
              <div className="edit-task-actions">
                <button type="button" className="edit-task-btn-cancel" onClick={handleAttemptClose}>
                  Cancel
                </button>
                <button type="button" className="edit-task-btn-save" disabled>
                  Loading…
                </button>
              </div>
            </div>
          ) : (
            <form className="edit-task-form" onSubmit={handleSubmit} noValidate>
              <div className="edit-task-field">
                <label htmlFor="edit-task-title" className="edit-task-label">
                  Title *
                </label>
                <input
                  id="edit-task-title"
                  type="text"
                  className={`edit-task-input ${fieldErrors.title ? 'has-error' : ''}`}
                  value={title}
                  maxLength={200}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (fieldErrors.title) {
                      setFieldErrors((prev) => ({ ...prev, title: undefined }));
                    }
                  }}
                  aria-invalid={fieldErrors.title ? 'true' : undefined}
                  aria-describedby={fieldErrors.title ? 'edit-task-title-error' : 'edit-task-counter'}
                />
                {fieldErrors.title ? (
                  <p id="edit-task-title-error" className="edit-task-field-error" role="alert">
                    {fieldErrors.title}
                  </p>
                ) : null}
                <span id="edit-task-counter" className="edit-task-counter">
                  {title.length} / 200 characters
                </span>
              </div>

              <div className="edit-task-field">
                <label htmlFor="edit-task-description" className="edit-task-label">
                  Description
                </label>
                <textarea
                  id="edit-task-description"
                  className="edit-task-textarea"
                  value={description}
                  disabled={isSubmitting}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="edit-task-field">
                <label htmlFor="edit-task-priority" className="edit-task-label">
                  Priority
                </label>
                <select
                  id="edit-task-priority"
                  className="edit-task-select"
                  value={priority}
                  disabled={isSubmitting}
                  onChange={(e) => setPriority(e.target.value as TaskPriority | '')}
                >
                  <option value="">None</option>
                  <option value={TaskPriority.Low}>Low</option>
                  <option value={TaskPriority.Medium}>Medium</option>
                  <option value={TaskPriority.High}>High</option>
                  <option value={TaskPriority.Critical}>Critical</option>
                </select>
              </div>

              <div className="edit-task-dates-row">
                <div className="edit-task-dates-col">
                  <label htmlFor="edit-task-start-date" className="edit-task-label">
                    Start date
                  </label>
                  <input
                    id="edit-task-start-date"
                    type="date"
                    className="edit-task-input"
                    value={startDate}
                    disabled={isSubmitting}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (fieldErrors.dueDate) {
                        setFieldErrors((prev) => ({ ...prev, dueDate: undefined }));
                      }
                    }}
                  />
                </div>

                <div className="edit-task-dates-col">
                  <label htmlFor="edit-task-due-date" className="edit-task-label">
                    Due date
                  </label>
                  <input
                    id="edit-task-due-date"
                    type="date"
                    className={`edit-task-input ${fieldErrors.dueDate ? 'has-error' : ''}`}
                    value={dueDate}
                    disabled={isSubmitting}
                    onChange={(e) => {
                      setDueDate(e.target.value);
                      if (fieldErrors.dueDate) {
                        setFieldErrors((prev) => ({ ...prev, dueDate: undefined }));
                      }
                    }}
                    aria-invalid={fieldErrors.dueDate ? 'true' : undefined}
                    aria-describedby={fieldErrors.dueDate ? 'edit-task-due-error' : undefined}
                  />
                </div>
              </div>
              {fieldErrors.dueDate && (
                <p id="edit-task-due-error" className="edit-task-field-error" role="alert">
                  {fieldErrors.dueDate}
                </p>
              )}

              <p className="edit-task-helper">Only Title is required.</p>

              <div className="edit-task-actions">
                <button
                  type="button"
                  className="edit-task-btn-cancel"
                  onClick={handleAttemptClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`edit-task-btn-save ${isDirty ? 'is-dirty' : 'is-pristine'}`}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? '◌ Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <DiscardChangesDialog
        isOpen={showDiscardConfirm}
        onKeepEditing={() => setShowDiscardConfirm(false)}
        onDiscard={handleConfirmDiscard}
      />
    </>
  );
}

function toInputDateFormat(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromInputDateFormat(val?: string | null): string | null {
  if (!val) return null;
  return new Date(`${val}T00:00:00Z`).toISOString();
}
