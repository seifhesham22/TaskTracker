import { useState, type FormEvent } from 'react';
import type { BoardValidationErrors } from '../../domain/models';
import './CreateBoardForm.css';

export interface CreateBoardFormProps {
  readonly projectName: string;
  readonly isSubmitting: boolean;
  readonly fieldErrors?: BoardValidationErrors;
  readonly formError?: string | null;
  readonly onSubmit: (name: string) => Promise<unknown>;
  readonly onCancel: () => void;
}

export function CreateBoardForm({
  projectName,
  isSubmitting,
  fieldErrors,
  formError,
  onSubmit,
  onCancel,
}: CreateBoardFormProps) {
  const [boardName, setBoardName] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit(boardName);
  };

  const hasNameError = Boolean(fieldErrors?.name);

  return (
    <div className="create-board-card" data-testid="create-board-form-card">
      <h2 className="create-board-title">Create a board</h2>
      <p className="create-board-project">{projectName}</p>

      {formError && (
        <div
          className="create-board-banner create-board-banner--error"
          role="alert"
          data-testid="board-create-error"
        >
          <p>{formError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="create-board-form">
        <div className="create-board-field">
          <label htmlFor="board-name-input" className="create-board-label">
            Board name *
          </label>
          <input
            id="board-name-input"
            type="text"
            className={`create-board-input ${hasNameError ? 'create-board-input--error' : ''}`}
            data-testid="board-name-input"
            value={boardName}
            onChange={(e) => setBoardName(e.target.value)}
            disabled={isSubmitting}
            placeholder="Enter a board name"
            aria-invalid={hasNameError}
            aria-describedby={hasNameError ? 'board-name-error' : 'board-name-helper'}
            autoFocus
          />
          {hasNameError && (
            <p
              id="board-name-error"
              className="create-board-error"
              role="alert"
              data-testid="board-name-error"
            >
              {fieldErrors?.name}
            </p>
          )}
        </div>

        <p id="board-name-helper" className="create-board-helper">
          This board will belong to {projectName}.
        </p>

        <div className="create-board-actions">
          <button
            type="submit"
            className="create-board-submit-btn"
            data-testid="create-board-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating…' : 'Create board'}
          </button>
          <button
            type="button"
            className="create-board-cancel-btn"
            data-testid="create-board-cancel-btn"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
