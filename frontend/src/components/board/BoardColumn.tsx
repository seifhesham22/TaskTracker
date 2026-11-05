import type { BoardColumnModel, ProjectMemberModel, TaskItem } from '../../domain/models';
import { StatusIcon } from './StatusIcon';
import { TaskCard } from './TaskCard';
import './BoardColumn.css';

export interface BoardColumnProps {
  readonly column: BoardColumnModel;
  readonly tasks: readonly TaskItem[];
  readonly members?: readonly ProjectMemberModel[];
  readonly onAddTask?: (columnId: string) => void;
}

export function BoardColumn({ column, tasks, members, onAddTask }: BoardColumnProps) {
  return (
    <section
      className="column"
      aria-labelledby={`col-heading-${column.id}`}
      data-testid={`board-column-${column.category}`}
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
            <TaskCard task={task} members={members} />
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
