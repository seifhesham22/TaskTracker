import { useId, useState } from 'react';
import type { TaskItem } from '../../domain/models';
import { SubtaskValidator } from '../../domain/validators/SubtaskValidator';
import './CreateSubtaskModal.css';

export interface CreateSubtaskModalProps {
  readonly parentTask: TaskItem | null;
  readonly projectName?: string | null;
  readonly isOpen: boolean;
  readonly isSubmitting?: boolean;
  readonly serverError?: string | null;
  readonly onClose: () => void;
  readonly onSubmit: (parentTask: TaskItem, title: string) => Promise<boolean>;
}

export function CreateSubtaskModal({
  parentTask,
  projectName,
  isOpen,
  isSubmitting = false,
  serverError,
  onClose,
  onSubmit,
}: CreateSubtaskModalProps) {
  if (!isOpen || !parentTask) {
    return null;
  }

  return (
    <CreateSubtaskModalContent
      key={`${parentTask.id}-${isOpen}`}
      parentTask={parentTask}
      projectName={projectName}
      isSubmitting={isSubmitting}
      serverError={serverError}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

interface CreateSubtaskModalContentProps {
  readonly parentTask: TaskItem;
  readonly projectName?: string | null;
  readonly isSubmitting: boolean;
  readonly serverError?: string | null;
  readonly onClose: () => void;
  readonly onSubmit: (parentTask: TaskItem, title: string) => Promise<boolean>;
}

function CreateSubtaskModalContent({
  parentTask,
  projectName,
  isSubmitting,
  serverError,
  onClose,
  onSubmit,
}: CreateSubtaskModalContentProps) {
  const [title, setTitle] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [internalServerError, setInternalServerError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const titleInputId = useId();
  const titleErrorId = useId();
  const headingId = useId();

  const validator = new SubtaskValidator();
  const activeServerError = internalServerError || serverError;
  const isLoading = isSubmitting || isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setInternalServerError(null);

    const validationResult = validator.validate({ title });
    if (!validationResult.isValid) {
      setValidationError(validationResult.errors.title ?? 'Subtask title is required.');
      return;
    }

    setValidationError(null);
    setIsPending(true);

    try {
      const success = await onSubmit(parentTask, title);
      if (success) {
        onClose();
      } else {
        setInternalServerError('We couldn’t create the subtask. Try again.');
      }
    } catch {
      setInternalServerError('We couldn’t create the subtask. Try again.');
    } finally {
      setIsPending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isLoading) {
      onClose();
    }
  };

  const displayProject = projectName || 'Project';

  return (
    <div
      className="subtask-modal-backdrop"
      onClick={() => {
        if (!isLoading) {
          onClose();
        }
      }}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        className="subtask-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={(e) => e.stopPropagation()}
        data-testid="create-subtask-modal"
      >
        <div className="subtask-modal-header">
          <div>
            <p className="subtask-modal-eyebrow">
              {displayProject} / {parentTask.readableId}
            </p>
            <h2 id={headingId} className="subtask-modal-title">
              Create subtask
            </h2>
          </div>
          <button
            type="button"
            className="subtask-modal-close"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close dialog"
            data-testid="close-create-subtask-modal"
          >
            ×
          </button>
        </div>

        <div className="subtask-parent-card">
          <p className="subtask-parent-label">PARENT TASK</p>
          <p className="subtask-parent-name">
            {parentTask.readableId} · {parentTask.title}
          </p>
        </div>

        {activeServerError && (
          <div
            className="subtask-error-banner"
            role="alert"
            data-testid="create-subtask-server-error"
          >
            {activeServerError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="subtask-field-group">
            <label htmlFor={titleInputId} className="subtask-field-label">
              Subtask title *
            </label>
            <input
              id={titleInputId}
              type="text"
              className={`subtask-field-input ${validationError ? 'has-error' : ''}`}
              placeholder="Enter a subtask title"
              value={title}
              disabled={isLoading}
              onChange={(e) => {
                setTitle(e.target.value);
                if (validationError) {
                  setValidationError(null);
                }
              }}
              aria-invalid={Boolean(validationError)}
              aria-describedby={validationError ? titleErrorId : undefined}
              data-testid="subtask-title-input"
              autoFocus
            />
            {validationError && (
              <p
                id={titleErrorId}
                className="subtask-field-error"
                role="alert"
                data-testid="subtask-title-error"
              >
                {validationError}
              </p>
            )}
            <p className="subtask-field-hint">
              The new subtask will appear under {parentTask.readableId}.
            </p>
          </div>

          <div className="subtask-modal-actions">
            <button
              type="button"
              className="subtask-button subtask-button-cancel"
              disabled={isLoading}
              onClick={onClose}
              data-testid="cancel-create-subtask"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="subtask-button subtask-button-submit"
              disabled={isLoading}
              data-testid="submit-create-subtask"
            >
              {isLoading ? '◌ Creating…' : 'Create subtask'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
