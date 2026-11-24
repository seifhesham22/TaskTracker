import { useEffect, useRef, useState } from 'react';
import type { CreateProjectInput } from '../../domain/models';
import type { ProjectSummary } from '../../api/services/AuthService';
import { projectValidator } from '../../domain/validators/ProjectValidator';
import './CreateProjectModal.css';

export interface CreateProjectModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (input: CreateProjectInput) => Promise<ProjectSummary | boolean>;
  readonly onSuccess?: (createdProject: ProjectSummary) => void;
}

export function CreateProjectModal({
  isOpen,
  onClose,
  onSubmit,
  onSuccess,
}: CreateProjectModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <CreateProjectModalContent
      onClose={onClose}
      onSubmit={onSubmit}
      onSuccess={onSuccess}
    />
  );
}

interface CreateProjectModalContentProps {
  readonly onClose: () => void;
  readonly onSubmit: (input: CreateProjectInput) => Promise<ProjectSummary | boolean>;
  readonly onSuccess?: (createdProject: ProjectSummary) => void;
}

function CreateProjectModalContent({
  onClose,
  onSubmit,
  onSuccess,
}: CreateProjectModalContentProps) {
  const [name, setName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const validation = projectValidator.validate({ name });
    if (!validation.isValid) {
      setErrorMessage(validation.errors.name || 'Enter a project name.');
      inputRef.current?.focus();
      return;
    }

    setErrorMessage(null);
    setServerError(null);
    setIsSubmitting(true);

    try {
      const result = await onSubmit({ name: name.trim() });
      if (result) {
        if (typeof result === 'object' && onSuccess) {
          onSuccess(result);
        }
        onClose();
      }
    } catch {
      setServerError('Couldn’t create the project. Your name is kept. Try again.');
      inputRef.current?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="create-project-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-project-title-heading"
      data-testid="create-project-dialog"
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="create-project-dialog">
        <header className="create-project-header">
          <h2 id="create-project-title-heading" className="create-project-title">
            Create a project
          </h2>
          <p className="create-project-subtitle">
            Give your team a shared workspace.
          </p>
        </header>

        <form className="create-project-form" onSubmit={handleSubmit} noValidate>
          <div className="create-project-field-group">
            <label htmlFor="create-project-name-input" className="create-project-label">
              Project name *
            </label>
            <input
              id="create-project-name-input"
              ref={inputRef}
              type="text"
              className={`create-project-input${errorMessage ? ' is-invalid' : ''}`}
              value={name}
              disabled={isSubmitting}
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={
                errorMessage
                  ? 'create-project-error create-project-helper'
                  : 'create-project-helper'
              }
              data-testid="create-project-name-input"
              onChange={(e) => {
                setName(e.target.value);
                if (errorMessage) {
                  setErrorMessage(null);
                }
                if (serverError) {
                  setServerError(null);
                }
              }}
            />
            {errorMessage && (
              <p
                id="create-project-error"
                className="create-project-error-text"
                role="alert"
                data-testid="create-project-field-error"
              >
                {errorMessage}
              </p>
            )}
            <p id="create-project-helper" className="create-project-helper-text">
              Required field. You will become this project’s Owner.
            </p>
          </div>

          {serverError && (
            <div
              className="create-project-error-banner"
              role="alert"
              data-testid="create-project-server-error"
            >
              <p>{serverError}</p>
            </div>
          )}

          <div className="create-project-actions">
            <button
              type="submit"
              className="create-project-primary-btn"
              disabled={isSubmitting}
              data-testid="create-project-submit-btn"
            >
              {isSubmitting ? 'Creating…' : 'Create project'}
            </button>
            <button
              type="button"
              className="create-project-secondary-btn"
              disabled={isSubmitting}
              onClick={handleClose}
              data-testid="create-project-cancel-btn"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
