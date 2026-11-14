import './DiscardChangesDialog.css';

export interface DiscardChangesDialogProps {
  readonly isOpen: boolean;
  readonly onKeepEditing: () => void;
  readonly onDiscard: () => void;
}

export function DiscardChangesDialog({
  isOpen,
  onKeepEditing,
  onDiscard,
}: DiscardChangesDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="discard-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-dialog-title"
      aria-describedby="discard-dialog-desc"
      data-testid="discard-changes-dialog"
    >
      <div className="discard-dialog">
        <div className="discard-header">
          <h3 id="discard-dialog-title" className="discard-title">
            Discard changes?
          </h3>
        </div>
        <p id="discard-dialog-desc" className="discard-message">
          Your unsaved changes will be lost.
        </p>
        <div className="discard-actions">
          <button
            type="button"
            className="discard-btn-keep"
            onClick={onKeepEditing}
          >
            Keep editing
          </button>
          <button
            type="button"
            className="discard-btn-discard"
            onClick={onDiscard}
          >
            Discard changes
          </button>
        </div>
      </div>
    </div>
  );
}
