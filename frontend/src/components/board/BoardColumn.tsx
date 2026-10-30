import type { BoardColumnModel, ProjectMemberModel, TaskItem } from '../../domain/models';
import { TaskCard } from './TaskCard';
import './BoardColumn.css';

export interface BoardColumnProps {
  readonly column: BoardColumnModel;
  readonly tasks: readonly TaskItem[];
  readonly members?: readonly ProjectMemberModel[];
}

export function BoardColumn({ column, tasks, members }: BoardColumnProps) {
  const indicatorColor = column.color || '#5B8DE8';

  return (
    <section
      className="board-column"
      aria-labelledby={`col-heading-${column.id}`}
      data-testid={`board-column-${column.category}`}
    >
      <header className="board-column__header">
        <div className="board-column__heading">
          <span
            className="board-column__indicator"
            style={{ backgroundColor: indicatorColor }}
            aria-hidden="true"
          />
          <h2 id={`col-heading-${column.id}`} className="board-column__title">
            {column.name}
          </h2>
        </div>
        <span
          className="board-column__count"
          aria-label={`${tasks.length} tasks in ${column.name}`}
        >
          {tasks.length}
        </span>
      </header>

      <div className="board-column__body" role="list">
        {tasks.length === 0 ? (
          <div className="board-column__empty" role="note">
            No tasks in this column
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} role="listitem">
              <TaskCard task={task} members={members} />
            </div>
          ))
        )}
      </div>
    </section>
  );
}

