import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ProjectRole, type ProjectMember } from '../../domain/models';
import { projectMemberValidator } from '../../domain/validators/ProjectMemberValidator';
import './AddMemberModal.css';

export interface AddMemberModalProps {
  readonly isOpen: boolean;
  readonly projectName: string;
  readonly existingMembers: readonly ProjectMember[];
  readonly onClose: () => void;
  readonly onSubmit: (input: { email: string; role: ProjectRole }) => Promise<ProjectMember>;
  readonly onSuccess?: (newMember: ProjectMember) => void;
}

export function AddMemberModal({
  isOpen,
  projectName,
  existingMembers,
  onClose,
  onSubmit,
  onSuccess,
}: AddMemberModalProps) {
  if (!isOpen) return null;

  return (
    <AddMemberModalContent
      projectName={projectName}
      existingMembers={existingMembers}
      onClose={onClose}
      onSubmit={onSubmit}
      onSuccess={onSuccess}
    />
  );
}

interface AddMemberModalContentProps {
  readonly projectName: string;
  readonly existingMembers: readonly ProjectMember[];
  readonly onClose: () => void;
  readonly onSubmit: (input: { email: string; role: ProjectRole }) => Promise<ProjectMember>;
  readonly onSuccess?: (newMember: ProjectMember) => void;
}

const ROLE_OPTIONS = [
  {
    role: ProjectRole.Writer,
    label: 'Writer',
    description: 'Can create and edit tasks, boards, and everyday work.',
  },
  {
    role: ProjectRole.Reader,
    label: 'Reader',
    description: 'Read-only access to view boards and tasks.',
  },
] as const;

function AddMemberModalContent({
  projectName,
  existingMembers,
  onClose,
  onSubmit,
  onSuccess,
}: AddMemberModalContentProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ProjectRole>(ProjectRole.Writer);
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedEmail = email.trim();
    const validation = projectMemberValidator.validate({
      projectId: 'temp',
      email: trimmedEmail,
      role,
    });

    if (!validation.isValid) {
      setErrorMessage(validation.errors.email || 'Enter an account email or name.');
      inputRef.current?.focus();
      return;
    }

    // Check if account is already a member locally
    const alreadyMember = existingMembers.some(
      (m) =>
        m.userName.toLowerCase() === trimmedEmail.toLowerCase()
    );

    if (alreadyMember) {
      setErrorMessage(`${trimmedEmail} is already a project member. Choose another account.`);
      inputRef.current?.focus();
      return;
    }

    setErrorMessage(null);
    setServerError(null);
    setIsSubmitting(true);

    try {
      const createdMember = await onSubmit({
        email: trimmedEmail,
        role,
      });

      if (onSuccess) {
        onSuccess(createdMember);
      }
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : `Couldn’t add ${trimmedEmail}. Your selection is kept. Try again.`;
      setServerError(msg);
      inputRef.current?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="add-member-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-member-title"
      data-testid="add-member-dialog"
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="add-member-dialog">
        <header className="add-member-header">
          <h2 id="add-member-title" className="add-member-title">
            Add a member
          </h2>
          <p className="add-member-subtitle">
            {projectName} · Existing accounts only
          </p>
        </header>

        <form className="add-member-form" onSubmit={handleSubmit} noValidate>
          <div className="add-member-field">
            <label htmlFor="add-member-email" className="add-member-label">
              Find an account *
            </label>
            <input
              id="add-member-email"
              ref={inputRef}
              type="text"
              className={`add-member-input${errorMessage ? ' is-invalid' : ''}`}
              placeholder="name@example.com"
              value={email}
              disabled={isSubmitting}
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={
                errorMessage ? 'add-member-field-error add-member-helper' : 'add-member-helper'
              }
              data-testid="add-member-email-input"
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorMessage) setErrorMessage(null);
                if (serverError) setServerError(null);
              }}
            />
            {errorMessage && (
              <div
                id="add-member-field-error"
                className="add-member-error-box"
                role="alert"
                data-testid="add-member-field-error"
              >
                <p>{errorMessage}</p>
              </div>
            )}
            <p id="add-member-helper" className="add-member-helper-text">
              Search by email or username of an existing account.
            </p>
          </div>

          <div className="add-member-field">
            <label htmlFor="add-member-role-select" className="add-member-label">
              Project role *
            </label>
            <div className="add-member-role-group" role="radiogroup" aria-label="Project role">
              {ROLE_OPTIONS.map((opt) => (
                <label
                  key={opt.role}
                  className={`add-member-role-card${role === opt.role ? ' is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="projectRole"
                    value={opt.role}
                    checked={role === opt.role}
                    disabled={isSubmitting}
                    onChange={() => setRole(opt.role)}
                    className="add-member-role-radio"
                  />
                  <div className="add-member-role-info">
                    <span className="add-member-role-title">{opt.label}</span>
                    <span className="add-member-role-desc">{opt.description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {serverError && (
            <div
              className="add-member-error-box"
              role="alert"
              data-testid="add-member-server-error"
            >
              <p>{serverError}</p>
            </div>
          )}

          <div className="add-member-actions">
            <button
              type="submit"
              className="add-member-primary-btn"
              disabled={isSubmitting || !email.trim()}
              data-testid="add-member-submit-btn"
            >
              {isSubmitting ? 'Adding…' : 'Add member'}
            </button>
            <button
              type="button"
              className="add-member-secondary-btn"
              disabled={isSubmitting}
              onClick={handleClose}
              data-testid="add-member-cancel-btn"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
