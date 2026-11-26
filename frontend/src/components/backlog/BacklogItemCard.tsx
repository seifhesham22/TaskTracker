import type React from 'react';
import type { BacklogItem } from '../../domain/models';
import { ColumnCategory, TaskPriority } from '../../domain/models';

export interface BacklogItemCardProps {
  readonly positionIndex: number;
  readonly item: BacklogItem;
  readonly canManage?: boolean;
  readonly isDraggable?: boolean;
  readonly isSaving?: boolean;
  readonly isDragging?: boolean;
  readonly isDropTarget?: boolean;
  readonly onOpenActions?: (item: BacklogItem) => void;
  readonly onDragStart?: (e: React.DragEvent<HTMLElement>, item: BacklogItem) => void;
  readonly onDragOver?: (e: React.DragEvent<HTMLElement>) => void;
  readonly onDragEnter?: (item: BacklogItem) => void;
  readonly onDrop?: (e: React.DragEvent<HTMLElement>, targetItem: BacklogItem) => void;
  readonly onDragEnd?: () => void;
}

function formatStatus(status: ColumnCategory): string {
  switch (status) {
    case ColumnCategory.Backlog:
      return 'Backlog';
    case ColumnCategory.ToDo:
      return 'To do';
    case ColumnCategory.InProgress:
      return 'In progress';
    case ColumnCategory.Done:
      return 'Done';
    case ColumnCategory.Cancelled:
      return 'Cancelled';
    default:
      return 'To do';
  }
}

function formatPriority(priority?: TaskPriority | null): string {
  switch (priority) {
    case TaskPriority.Critical:
      return 'Critical';
    case TaskPriority.High:
      return 'High';
    case TaskPriority.Medium:
      return 'Medium';
    case TaskPriority.Low:
      return 'Low';
    default:
      return 'No priority';
  }
}

export function BacklogItemCard({
  positionIndex,
  item,
  canManage = false,
  isDraggable = false,
  isSaving = false,
  isDragging = false,
  isDropTarget = false,
  onOpenActions,
  onDragStart,
  onDragOver,
  onDragEnter,
  onDrop,
  onDragEnd,
}: BacklogItemCardProps) {
  const statusLabel = formatStatus(item.status);
  const priorityLabel = formatPriority(item.priority);
  const estimateLabel = 'Estimate: Not estimated';

  const cardClasses = [
    'backlog-item-card',
    isDraggable ? 'backlog-item-draggable' : '',
    isDragging ? 'backlog-item-dragging' : '',
    isDropTarget ? 'backlog-item-drop-target' : '',
    isSaving ? 'backlog-item-saving' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article
      className={cardClasses}
      data-testid={`backlog-item-${item.id}`}
      aria-labelledby={`backlog-item-title-${item.id}`}
      draggable={isDraggable}
      onDragStart={(e) => {
        if (!isDraggable) return;
        e.dataTransfer.setData('text/plain', item.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.(e, item);
      }}
      onDragOver={(e) => {
        if (!isDraggable) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver?.(e);
      }}
      onDragEnter={() => {
        if (!isDraggable) return;
        onDragEnter?.(item);
      }}
      onDrop={(e) => {
        if (!isDraggable) return;
        e.preventDefault();
        onDrop?.(e, item);
      }}
      onDragEnd={onDragEnd}
    >
      <div className="backlog-item-main-row">
        {canManage && (
          <div
            className={`backlog-drag-handle ${!isDraggable ? 'backlog-drag-handle-disabled' : ''}`}
            role="button"
            tabIndex={isDraggable ? 0 : -1}
            aria-label={`Drag item to reorder ${item.readableId}`}
            aria-grabbed={isDragging}
            aria-disabled={!isDraggable}
            title={isDraggable ? 'Drag item to reorder' : 'Reordering is disabled'}
            data-testid={`backlog-drag-handle-${item.id}`}
          >
            ⠿
          </div>
        )}

        <div className="backlog-item-content">
          <div className="backlog-item-meta" data-testid={`backlog-item-meta-${item.id}`}>
            {positionIndex} · {item.readableId}
          </div>
          <h4 id={`backlog-item-title-${item.id}`} className="backlog-item-title">
            {item.title}
          </h4>
          <div className="backlog-item-details">
            <span className="backlog-item-status-priority">
              {statusLabel} · {priorityLabel} {estimateLabel}
            </span>
          </div>
        </div>

        {canManage && (
          <button
            type="button"
            className="backlog-item-actions-btn"
            data-testid={`backlog-item-actions-btn-${item.id}`}
            aria-label={`Item actions for ${item.readableId}`}
            title="Item actions"
            onClick={() => onOpenActions?.(item)}
          >
            ⋯
          </button>
        )}
      </div>
    </article>
  );
}

