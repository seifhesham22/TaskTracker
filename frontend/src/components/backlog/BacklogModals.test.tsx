import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ColumnCategory, TaskPriority, type BacklogItem } from '../../domain/models';
import { BacklogItemActionsModal } from './BacklogItemActionsModal';
import { BacklogMovePositionModal } from './BacklogMovePositionModal';
import { BacklogPriorityModal } from './BacklogPriorityModal';

describe('Backlog Modals Unit Tests', () => {
  const item: BacklogItem = {
    id: 'item-1',
    readableId: 'TES-100',
    number: 100,
    boardId: 'board-1',
    title: 'Deploy to Kubernetes',
    status: ColumnCategory.InProgress,
    priority: TaskPriority.Medium,
  };

  const sampleItems: BacklogItem[] = [
    { ...item, id: 'item-0', readableId: 'TES-99' },
    item,
    { ...item, id: 'item-2', readableId: 'TES-101' },
  ];

  describe('BacklogItemActionsModal', () => {
    it('renders with item details and triggers callbacks', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onMoveUp = vi.fn();
      const onMoveDown = vi.fn();
      const onOpenMovePosition = vi.fn();
      const onOpenPriority = vi.fn();

      render(
        <BacklogItemActionsModal
          isOpen={true}
          item={item}
          currentPosition={2}
          totalCount={3}
          canReorder={true}
          onClose={onClose}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onOpenMovePosition={onOpenMovePosition}
          onOpenPriority={onOpenPriority}
        />
      );

      expect(screen.getByText('Item actions')).toBeInTheDocument();
      expect(screen.getByText('TES-100 · Current position 2 of 3')).toBeInTheDocument();

      // Both move up and move down are enabled at position 2 of 3
      expect(screen.getByTestId('backlog-action-move-up')).toBeEnabled();
      expect(screen.getByTestId('backlog-action-move-down')).toBeEnabled();

      await user.click(screen.getByTestId('backlog-action-move-up'));
      expect(onMoveUp).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('disables reorder options when canReorder is false', () => {
      render(
        <BacklogItemActionsModal
          isOpen={true}
          item={item}
          currentPosition={1}
          totalCount={3}
          canReorder={false}
          onClose={vi.fn()}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          onOpenMovePosition={vi.fn()}
          onOpenPriority={vi.fn()}
        />
      );

      expect(screen.getByTestId('backlog-actions-filter-notice')).toBeInTheDocument();
      expect(screen.getByTestId('backlog-action-move-up')).toBeDisabled();
      expect(screen.getByTestId('backlog-action-move-down')).toBeDisabled();
      expect(screen.getByTestId('backlog-action-move-position')).toBeDisabled();
      expect(screen.getByTestId('backlog-action-change-priority')).toBeEnabled();
    });
  });

  describe('BacklogMovePositionModal', () => {
    it('validates position input and triggers onSubmit with valid position', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const onClose = vi.fn();

      render(
        <BacklogMovePositionModal
          isOpen={true}
          item={item}
          currentPosition={2}
          totalCount={3}
          items={sampleItems}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      );

      expect(screen.getByText('Move to a global position')).toBeInTheDocument();

      const input = screen.getByTestId('backlog-position-input');
      expect(input).toHaveValue(2);

      // Change to invalid position 10
      await user.clear(input);
      await user.type(input, '10');
      expect(screen.getByTestId('backlog-position-error')).toHaveTextContent(
        'Enter a position between 1 and 3'
      );
      expect(screen.getByTestId('backlog-move-submit-btn')).toBeDisabled();

      // Change to position 1 (top of backlog)
      await user.clear(input);
      await user.type(input, '1');
      expect(screen.getByTestId('backlog-position-preview')).toHaveTextContent(
        'Move this item to the top of the backlog.'
      );
      expect(screen.getByTestId('backlog-move-submit-btn')).toBeEnabled();

      // Submit
      await user.click(screen.getByTestId('backlog-move-submit-btn'));
      expect(onSubmit).toHaveBeenCalledWith(1);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('BacklogPriorityModal', () => {
    it('displays priority options and submits selected priority', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const onClose = vi.fn();

      render(
        <BacklogPriorityModal
          isOpen={true}
          item={item}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      );

      expect(screen.getByText('Change item priority')).toBeInTheDocument();
      expect(screen.getByText('Set priority for TES-100.')).toBeInTheDocument();

      // Save button disabled initially because unchanged (Medium)
      expect(screen.getByTestId('backlog-priority-submit-btn')).toBeDisabled();

      // Select High
      await user.click(screen.getByTestId('backlog-priority-option-HIGH'));
      expect(screen.getByTestId('backlog-priority-submit-btn')).toBeEnabled();

      // Submit
      await user.click(screen.getByTestId('backlog-priority-submit-btn'));
      expect(onSubmit).toHaveBeenCalledWith(TaskPriority.High);
      expect(onClose).toHaveBeenCalled();
    });
  });
});
