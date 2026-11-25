import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/useAuth';
import { useProjects } from '../hooks/useProjects';
import { CreateProjectModal } from '../components/project/CreateProjectModal';
import './ProjectsPage.css';

export function ProjectsPage() {
  const { user } = useAuth();
  const { projects, isLoading, error, reload, createProject } = useProjects(user?.id);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createdBanner, setCreatedBanner] = useState<string | null>(null);

  const formatRoleText = (role?: string) => {
    if (!role) return 'Private project';
    const capitalized = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
    return `${capitalized} · Private project`;
  };

  return (
    <div className="projects-page">
      <header className="projects-header">
        <p className="projects-eyebrow">Workspace</p>
        <h1 className="projects-title" aria-label="Available Projects - Your projects">
          Your projects
        </h1>
        <p className="projects-subtitle">
          Projects you belong to
        </p>
      </header>

      {createdBanner && (
        <div className="projects-status-banner" role="status" data-testid="project-created-banner">
          <p>{createdBanner}</p>
        </div>
      )}

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
          <p>No projects yet. Create your first project to get started.</p>
          <button
            type="button"
            className="projects-create-btn"
            data-testid="create-project-btn"
            onClick={() => {
              setCreatedBanner(null);
              setIsCreateModalOpen(true);
            }}
          >
            Create project
          </button>
        </div>
      )}

      {!isLoading && !error && projects.length > 0 && (
        <>
          <div className="projects-grid">
            {projects.map((project) => {
              const primaryTarget =
                project.boards && project.boards.length > 0
                  ? `/boards/${project.boards[0].id}`
                  : `/projects/${project.id}/backlog`;

              return (
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

                  <p className="project-role-text">{formatRoleText(project.role)}</p>

                  <div className="project-card-actions">
                    <Link
                      to={primaryTarget}
                      className="project-open-btn"
                      data-testid={`open-project-btn-${project.id}`}
                    >
                      Open project
                    </Link>
                    <Link
                      to={`/projects/${project.id}/members`}
                      className="project-members-link"
                      data-testid={`project-members-link-${project.id}`}
                    >
                      Members →
                    </Link>
                  </div>

                  {project.description && (
                    <p className="project-card-desc">{project.description}</p>
                  )}

                  <div className="project-boards-section">
                    <div className="project-section-header">
                      <h3 className="project-boards-title">Boards & Backlog</h3>
                      <div className="project-section-links">
                        <Link
                          to={`/projects/${project.id}/boards`}
                          className="project-boards-link"
                          data-testid={`project-boards-link-${project.id}`}
                        >
                          Boards →
                        </Link>
                        <Link
                          to={`/projects/${project.id}/backlog`}
                          className="project-backlog-link"
                          data-testid={`project-backlog-link-${project.id}`}
                        >
                          Backlog →
                        </Link>
                      </div>
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
              );
            })}
          </div>

          <button
            type="button"
            className="projects-create-btn"
            data-testid="create-project-btn"
            onClick={() => {
              setCreatedBanner(null);
              setIsCreateModalOpen(true);
            }}
          >
            Create project
          </button>
        </>
      )}

      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={createProject}
        onSuccess={() => {
          setCreatedBanner('✓ Project created. You are the Owner.');
        }}
      />
    </div>
  );
}
