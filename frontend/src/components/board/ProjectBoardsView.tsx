import { Link } from 'react-router';
import './ProjectBoardsView.css';

export interface ProjectBoardSummary {
  readonly id: string;
  readonly name: string;
}

export interface ProjectBoardsViewProps {
  readonly projectName: string;
  readonly role?: string | null;
  readonly isOwner: boolean;
  readonly boards: readonly ProjectBoardSummary[];
  readonly onCreateBoard: () => void;
}

export function ProjectBoardsView({
  projectName,
  role,
  isOwner,
  boards,
  onCreateBoard,
}: ProjectBoardsViewProps) {
  const formattedRole = role
    ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()
    : 'Member';

  return (
    <div className="project-boards-card" data-testid="project-boards-card">
      <h2 className="project-boards-title">Project boards</h2>
      <p className="project-boards-subtitle" data-testid="project-boards-subtitle">
        {projectName} · {formattedRole}
      </p>

      <div className="project-boards-list" role="list">
        {boards.length === 0 ? (
          <p className="project-boards-empty">No boards in this project yet.</p>
        ) : (
          boards.map((board) => (
            <div key={board.id} className="project-board-item" role="listitem">
              <div className="project-board-item-header">
                <span className="project-board-name">{board.name}</span>
                <p className="project-board-context">Board · {projectName}</p>
              </div>
              <Link
                to={`/boards/${board.id}`}
                className="project-board-open-btn"
                data-testid={`open-board-btn-${board.id}`}
              >
                Open board
              </Link>
            </div>
          ))
        )}
      </div>

      {isOwner ? (
        <button
          type="button"
          className="project-board-create-btn"
          data-testid="start-create-board-btn"
          onClick={onCreateBoard}
        >
          Create board
        </button>
      ) : (
        <p className="project-boards-role-note" data-testid="create-board-role-note">
          Only an Owner can create boards.
        </p>
      )}
    </div>
  );
}
