import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { BacklogItem } from '../../domain/models';
import './BacklogMovePositionModal.css';

export interface BacklogMovePositionModalProps {
  readonly isOpen: boolean;
  readonly item: BacklogItem | null;
  readonly currentPosition: number;
  readonly totalCount: number;
  readonly items: readonly BacklogItem[];
  readonly onClose: () => void;
  readonly onSubmit: (newPosition1Based: number) => void;
}

export function BacklogMovePositionModal({
  isOpen,
  item,
  currentPosition,
  totalCount,
  items,
  onClose,
  onSubmit,
}: BacklogMovePositionModalProps) {
  if (!isOpen || !item) {
    return null;
  }

  return (
    <BacklogMovePositionModalContent
      item={item}
      currentPosition={currentPosition}
      totalCount={totalCount}
      items={items}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

interface BacklogMovePositionModalContentProps {
  readonly item: BacklogItem;
  readonly currentPosition: number;
  readonly totalCount: number;
  readonly items: readonly BacklogItem[];
  readonly onClose: () => void;
  readonly onSubmit: (newPosition1Based: number) => void;
}

function BacklogMovePositionModalContent({
  item,
  currentPosition,
  totalCount,
  items,
  onClose,
  onSubmit,
}: BacklogMovePositionModalContentProps) {
  const [positionInput, setPositionInput] = useState<string>(String(currentPosition));
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const parsedPos = parseInt(positionInput, 10);
  const isInvalid =
    !positionInput.trim() ||
    Number.isNaN(parsedPos) ||
    parsedPos < 1 ||
    parsedPos > totalCount;

  // Determine preview text
  let previewText = '';
  if (!isInvalid) {
    if (parsedPos === 1) {
      previewText = 'Move this item to the top of the backlog.';
    } else {
      const pageStartIndex = currentPosition - (items.findIndex((i) => i.id === item.id) + 1);
      const precedingGlobalPos = parsedPos > currentPosition ? parsedPos : parsedPos - 1;
      const precedingLocalIndex = precedingGlobalPos - pageStartIndex - 1;
      const preceding = items[precedingLocalIndex];
      if (preceding && preceding.id !== item.id) {
        previewText = `Move this item after ${preceding.readableId}.`;
      } else {
        previewText = `Move this item to position ${parsedPos}.`;
      }
    }
  }

  const handleInputChange = (val: string) => {
    setPositionInput(val);
    const num = parseInt(val, 10);
    if (!val.trim() || Number.isNaN(num) || num < 1 || num > totalCount) {
      setError(`Enter a position between 1 and ${totalCount}`);
    } else {
      setError(null);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isInvalid) {
      setError(`Enter a position between 1 and ${totalCount}`);
      return;
    }
    onSubmit(parsedPos);
    onClose();
  };

  return (
    <div
      className="backlog-modal-backdrop"
      data-testid="backlog-move-position-modal"
      onClick={onClose}
    >
      <div
        className="backlog-modal-dialog backlog-move-position-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backlog-move-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="backlog-modal-header">
          <h3 id="backlog-move-title" className="backlog-modal-title">
            Move to a global position
          </h3>
          <p className="backlog-modal-subtitle">
            Enter a position from 1 to {totalCount} for {item.readableId}.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="backlog-move-form">
          <div className="backlog-field-group">
            <label htmlFor="backlog-new-position-input" className="backlog-field-label">
              New position *
            </label>
            <input
              id="backlog-new-position-input"
              ref={inputRef}
              type="number"
              min="1"
              max={totalCount}
              className={`backlog-input ${error ? 'backlog-input-error' : ''}`}
              value={positionInput}
              onChange={(e) => handleInputChange(e.target.value)}
              data-testid="backlog-position-input"
              autoFocus
            />
            {error && (
              <p className="backlog-error-text" role="alert" data-testid="backlog-position-error">
                {error}
              </p>
            )}
            {!error && previewText && (
              <p className="backlog-preview-text" data-testid="backlog-position-preview">
                {previewText}
              </p>
            )}
          </div>

          <div className="backlog-modal-actions">
            <button
              type="button"
              className="backlog-btn-secondary"
              data-testid="backlog-move-cancel-btn"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="backlog-btn-primary"
              data-testid="backlog-move-submit-btn"
              disabled={isInvalid || parsedPos === currentPosition}
            >
              Move item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
