import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../auth/useAuth';
import { useProjectBoards } from '../hooks/useProjectBoards';
import { CreateBoardForm } from '../components/board/CreateBoardForm';
import { ProjectBoardsView } from '../components/board/ProjectBoardsView';
import './ProjectBoardsPage.css';

export function ProjectBoardsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    project,
    boards,
    role,
    isOwner,
    isLoading,
    isNotFound,
    error,
    isSubmitting,
    fieldErrors,
    submitError,
    createBoard,
    clearFieldErrors,
    clearSubmitError,
    reload,
  } = useProjectBoards(projectId || '', user?.id);

  const initialCreateMode = searchParams.get('create') === 'true';
  const [isCreateMode, setIsCreateMode] = useState(initialCreateMode);

  const handleStartCreate = () => {
    clearFieldErrors();
    clearSubmitError();
    setIsCreateMode(true);
    setSearchParams({ create: 'true' });
  };

  const handleCancelCreate = () => {
    clearFieldErrors();
    clearSubmitError();
    setIsCreateMode(false);
    setSearchParams({});
  };

  const handleCreateSubmit = async (name: string) => {
    const newBoard = await createBoard(name);
    if (newBoard) {
      navigate(
        `/boards/${newBoard.id}?created=true&projectName=${encodeURIComponent(project?.name || '')}`
      );
    }
  };

  return (
    <div className="project-boards-page" data-testid="project-boards-page">
      <header className="project-boards-header">
        <div className="project-boards-nav-context">
          <span className="project-boards-brand">▥ TaskTracker</span>
          <nav className="project-boards-breadcrumb" aria-label="Breadcrumb">
            <span>Projects / Create a board</span>
          </nav>
        </div>
      </header>

      <main className="project-boards-main">
        {isLoading && (
          <div className="project-boards-loading" role="status">
            <span>Loading project boards…</span>
          </div>
        )}

        {error && !isLoading && (
          <div className="project-boards-error-card" role="alert">
            <h2 className="project-boards-title">
              {isNotFound ? 'Project unavailable' : 'Error'}
            </h2>
            <p className="project-boards-subtitle">{error}</p>
            <button type="button" className="project-board-create-btn" onClick={reload}>
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && project && (
          <>
            {isCreateMode && isOwner ? (
              <CreateBoardForm
                projectName={project.name}
                isSubmitting={isSubmitting}
                fieldErrors={fieldErrors}
                formError={submitError}
                onSubmit={handleCreateSubmit}
                onCancel={handleCancelCreate}
              />
            ) : (
              <ProjectBoardsView
                projectName={project.name}
                role={role}
                isOwner={isOwner}
                boards={boards}
                onCreateBoard={handleStartCreate}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
