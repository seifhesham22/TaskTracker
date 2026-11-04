import type { BoardColumn, Task } from '../../domain/models';
import { SelectionSheet } from '../form/fields';
import { StatusIcon } from './markers';

export function MoveTaskSheet({
  task,
  columns,
  onSelect,
  onClose,
}: {
  task: Task;
  columns: BoardColumn[];
  onSelect: (column: BoardColumn) => void;
  onClose: () => void;
}) {
  return (
    <SelectionSheet
      visible
      title="Move to column"
      description={task.title}
      testID="move-task-sheet"
      selectedKey={task.columnId}
      options={columns.map((column) => ({
        key: column.id,
        label: column.name,
        detail: column.id === task.columnId ? 'Current' : undefined,
        leading: <StatusIcon category={column.category} color={column.color} />,
      }))}
      onSelect={(key) => {
        const column = columns.find((candidate) => candidate.id === key);
        if (column) onSelect(column);
      }}
      onClose={onClose}
    />
  );
}
