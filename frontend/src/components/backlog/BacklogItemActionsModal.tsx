import { useEffect } from 'react';
import type { BacklogItem } from '../../domain/models';
import './BacklogItemActionsModal.css';

export interface BacklogItemActionsModalProps {
  readonly isOpen: boolean;
  readonly item: BacklogItem | null;
  readonly currentPosition: number;
  readonly totalCount: number;
  readonly canReorder: boolean;
  readonly onClose: () => void;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
  readonly onOpenMovePosition: () => void;
  readonly onOpenPriority: () => void;
}

export function BacklogItemActionsModal({
  isOpen,
  item,
  currentPosition,
  totalCount,
  canReorder,
  onClose,
  onMoveUp,
  onMoveDown,
  onOpenMovePosition,
  onOpenPriority,
}: BacklogItemActionsModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !item) {
    return null;
  }

  const isFirst = currentPosition <= 1;
  const isLast = currentPosition >= totalCount;

  return (
    <div
      className="backlog-modal-backdrop"
      data-testid="backlog-item-actions-modal"
      onClick={onClose}
    >
      <div
        className="backlog-modal-dialog backlog-item-actions-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backlog-actions-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="backlog-modal-header">
          <h3 id="backlog-actions-title" className="backlog-modal-title">
            Item actions
          </h3>
          <p className="backlog-modal-subtitle">
            {item.readableId} · Current position {currentPosition} of {totalCount}
          </p>
        </header>

        {!canReorder && (
          <div
            className="backlog-actions-filter-notice"
            role="note"
            data-testid="backlog-actions-filter-notice"
          >
            Reordering is disabled while search or filters are active. Clear filters to reorder tasks.
          </div>
        )}

        <div className="backlog-actions-list" role="menu">
          <button
            type="button"
            className="backlog-action-btn"
            data-testid="backlog-action-move-up"
            disabled={!canReorder || isFirst}
            onClick={() => {
              onMoveUp();
              onClose();
            }}
          >
            <span className="backlog-action-icon" aria-hidden="true">↑</span>
            <span>Move up</span>
            {isFirst && <span className="backlog-action-hint">Already at top</span>}
          </button>

          <button
            type="button"
            className="backlog-action-btn"
            data-testid="backlog-action-move-down"
            disabled={!canReorder || isLast}
            onClick={() => {
              onMoveDown();
              onClose();
            }}
          >
            <span className="backlog-action-icon" aria-hidden="true">↓</span>
            <span>Move down</span>
            {isLast && <span className="backlog-action-hint">Already at bottom</span>}
          </button>

          <button
            type="button"
            className="backlog-action-btn"
            data-testid="backlog-action-move-position"
            disabled={!canReorder}
            onClick={() => {
              onClose();
              onOpenMovePosition();
            }}
          >
            <span className="backlog-action-icon" aria-hidden="true">#</span>
            <span>Move to position…</span>
          </button>

          <button
            type="button"
            className="backlog-action-btn"
            data-testid="backlog-action-change-priority"
            onClick={() => {
              onClose();
              onOpenPriority();
            }}
          >
            <span className="backlog-action-icon" aria-hidden="true">⚑</span>
            <span>Change priority</span>
          </button>
        </div>

        <div className="backlog-modal-actions">
          <button
            type="button"
            className="backlog-btn-secondary"
            data-testid="backlog-action-cancel"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
