import { useState } from 'react';
import type { ProjectMember } from '../../domain/models';
import './RemoveMemberModal.css';

export interface RemoveMemberModalProps {
  readonly isOpen: boolean;
  readonly projectName: string;
  readonly targetMember: ProjectMember | null;
  readonly isLastOwner: boolean;
  readonly onClose: () => void;
  readonly onConfirm: (userId: string) => Promise<void>;
  readonly onSuccess?: (removedMember: ProjectMember) => void;
}

export function RemoveMemberModal({
  isOpen,
  projectName,
  targetMember,
  isLastOwner,
  onClose,
  onConfirm,
  onSuccess,
}: RemoveMemberModalProps) {
  if (!isOpen || !targetMember) return null;

  return (
    <RemoveMemberModalContent
      projectName={projectName}
      targetMember={targetMember}
      isLastOwner={isLastOwner}
      onClose={onClose}
      onConfirm={onConfirm}
      onSuccess={onSuccess}
    />
  );
}

interface RemoveMemberModalContentProps {
  readonly projectName: string;
  readonly targetMember: ProjectMember;
  readonly isLastOwner: boolean;
  readonly onClose: () => void;
  readonly onConfirm: (userId: string) => Promise<void>;
  readonly onSuccess?: (removedMember: ProjectMember) => void;
}

function RemoveMemberModalContent({
  projectName,
  targetMember,
  isLastOwner,
  onClose,
  onConfirm,
  onSuccess,
}: RemoveMemberModalContentProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  const handleRemove = async () => {
    if (isSubmitting) return;
    setServerError(null);
    setIsSubmitting(true);

    try {
      await onConfirm(targetMember.userId);
      if (onSuccess) {
        onSuccess(targetMember);
      }
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : `Couldn’t remove ${targetMember.userName}. They are still a member. Try again.`;
      setServerError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLastOwner) {
    return (
      <div
        className="remove-member-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="last-owner-title"
        data-testid="last-owner-dialog"
        onKeyDown={handleKeyDown}
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        <div className="remove-member-dialog">
          <header className="remove-member-header">
            <h2 id="last-owner-title" className="remove-member-title">
              Owner required
            </h2>
            <p className="remove-member-subtitle">{projectName}</p>
          </header>

          <div className="remove-member-error-box" role="alert" data-testid="last-owner-error">
            <p>You can’t remove the last Owner.</p>
          </div>

          <p className="remove-member-desc">
            Keep at least one Owner in this project. No membership was changed.
          </p>

          <div className="remove-member-actions">
            <button
              type="button"
              className="remove-member-primary-btn"
              onClick={handleClose}
              data-testid="last-owner-close-btn"
            >
              Keep Owner
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="remove-member-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-member-title"
      data-testid="remove-member-dialog"
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="remove-member-dialog">
        <header className="remove-member-header">
          <h2 id="remove-member-title" className="remove-member-title">
            Remove {targetMember.userName}?
          </h2>
          <p className="remove-member-subtitle">{projectName}</p>
        </header>

        <p className="remove-member-desc">
          {targetMember.userName} will lose access to this project’s boards and tasks. This does not
          delete their account or existing work.
        </p>

        {serverError && (
          <div
            className="remove-member-error-box"
            role="alert"
            data-testid="remove-member-server-error"
          >
            <p>{serverError}</p>
          </div>
        )}

        <div className="remove-member-actions">
          <button
            type="button"
            className="remove-member-primary-btn"
            disabled={isSubmitting}
            onClick={handleRemove}
            data-testid="remove-member-confirm-btn"
          >
            {isSubmitting ? 'Removing…' : 'Remove'}
          </button>
          <button
            type="button"
            className="remove-member-secondary-btn"
            disabled={isSubmitting}
            onClick={handleClose}
            data-testid="remove-member-cancel-btn"
          >
            Keep member
          </button>
        </div>
      </div>
    </div>
  );
}
