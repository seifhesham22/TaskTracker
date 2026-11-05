import { useState } from 'react';
import type { BoardColumnModel, ProjectMemberModel, TaskItem } from '../../domain/models';
import { StatusIcon } from './StatusIcon';
import { TaskCard } from './TaskCard';
import './BoardColumn.css';

export interface BoardColumnProps {
  readonly column: BoardColumnModel;
  readonly tasks: readonly TaskItem[];
  readonly members?: readonly ProjectMemberModel[];
  readonly savingTaskIds?: ReadonlySet<string>;
  readonly onAddTask?: (columnId: string) => void;
  readonly onDropTask?: (taskId: string, targetColumnId: string) => void;
}

export function BoardColumn({
  column,
  tasks,
  members,
  savingTaskIds,
  onAddTask,
  onDropTask,
}: BoardColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskId =
      e.dataTransfer.getData('application/x-task-id') || e.dataTransfer.getData('text/plain');
    if (taskId && onDropTask) {
      onDropTask(taskId, column.id);
    }
  };

  return (
    <section
      className={`column ${isDragOver ? 'column--drag-over' : ''}`}
      aria-labelledby={`col-heading-${column.id}`}
      data-testid={`board-column-${column.category}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="column-title">
        <StatusIcon category={column.category} color={column.color} />
        <h2 id={`col-heading-${column.id}`}>
          {column.name}
        </h2>
        <span
          className="count"
          aria-label={`${tasks.length} tasks in ${column.name}`}
        >
          {tasks.length}
        </span>
        {onAddTask && (
          <button
            type="button"
            aria-label={`Add task to ${column.name}`}
            onClick={() => onAddTask(column.id)}
          >
            <img src="/assets/9b420.svg" alt="" width="16" height="16" />
          </button>
        )}
      </div>

      <div className="column-cards" role="list">
        {tasks.map((task) => (
          <div key={task.id} role="listitem">
            <TaskCard
              task={task}
              members={members}
              isSaving={savingTaskIds?.has(task.id)}
            />
          </div>
        ))}
      </div>

      {onAddTask && (
        <button
          type="button"
          className="add-task"
          onClick={() => onAddTask(column.id)}
        >
          <img src="/assets/d3182.svg" alt="" width="16" height="16" />
          Add task
        </button>
      )}
    </section>
  );
}
