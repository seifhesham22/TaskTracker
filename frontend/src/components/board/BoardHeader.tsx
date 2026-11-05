import './BoardHeader.css';

export interface BoardHeaderProps {
  readonly projectName?: string | null;
  readonly boardName?: string | null;
  readonly taskCount: number;
  readonly onOpenCreateTask: () => void;
}

export function BoardHeader({
  projectName,
  boardName,
  taskCount,
  onOpenCreateTask,
}: BoardHeaderProps) {
  return (
    <div className="board-header">
      <div>
        <p className="crumb">
          {projectName || 'Test Project'}{' '}
          <img src="/assets/03b1a.svg" alt="" width="14" height="14" /> Boards
        </p>
        <div className="board-name">
          <h1 className="board-name__title">{boardName || 'Test Board'}</h1>
          <span className="board-name__count">{taskCount} tasks</span>
        </div>
      </div>

      <div className="board-header__actions">
        <button
          type="button"
          className="button button-dark"
          onClick={onOpenCreateTask}
          data-testid="create-task-btn"
        >
          <img src="/assets/57429.svg" alt="" width="16" height="16" />
          New task
        </button>
      </div>
    </div>
  );
}
