import { Link } from 'react-router';
import { useAuth } from '../auth/useAuth';
import { useProjects } from '../hooks/useProjects';
import './ProjectsPage.css';

export function ProjectsPage() {
  const { user } = useAuth();
  const { projects, isLoading, error, reload } = useProjects(user?.id);

  return (
    <div className="projects-page">
      <header className="projects-header">
        <p className="projects-eyebrow">Workspace</p>
        <h1 className="projects-title">Available Projects</h1>
        <p className="projects-subtitle">
          Select a project board to view tasks and collaborate with your team.
        </p>
      </header>

      {isLoading && (
        <div className="projects-loading" role="status">
          <span>Loading projects…</span>
        </div>
      )}

      {error && !isLoading && (
        <div className="projects-error" role="alert">
          <p>{error}</p>
          <button type="button" className="auth-button" onClick={reload}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && projects.length === 0 && (
        <div className="projects-empty">
          <p>No projects available. You haven't been added to any projects yet.</p>
        </div>
      )}

      {!isLoading && !error && projects.length > 0 && (
        <div className="projects-grid">
          {projects.map((project) => (
            <article key={project.id} className="project-card" aria-labelledby={`project-${project.id}`}>
              <div className="project-card-header">
                <h2 id={`project-${project.id}`} className="project-card-title">
                  {project.name}
                </h2>
                <div className="project-card-badges">
                  <span className="project-badge-key">{project.key}</span>
                  <span className="project-badge-role">{project.role}</span>
                </div>
              </div>

              {project.description && (
                <p className="project-card-desc">{project.description}</p>
              )}

              <div className="project-boards-section">
                <div className="project-section-header">
                  <h3 className="project-boards-title">Boards & Backlog</h3>
                  <Link
                    to={`/projects/${project.id}/backlog`}
                    className="project-backlog-link"
                    data-testid={`project-backlog-link-${project.id}`}
                  >
                    Backlog →
                  </Link>
                </div>
                {project.boards.length === 0 ? (
                  <p className="project-card-desc">No boards available in this project.</p>
                ) : (
                  <ul className="project-boards-list">
                    {project.boards.map((board) => (
                      <li key={board.id}>
                        <Link to={`/boards/${board.id}`} className="project-board-link">
                          {board.name} →
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
