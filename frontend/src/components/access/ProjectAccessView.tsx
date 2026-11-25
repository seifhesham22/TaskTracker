import type { ProjectAccessState } from '../../domain/projectAccess';
import './ProjectAccessView.css';

export interface ProjectAccessViewProps {
  readonly accessState: ProjectAccessState;
  readonly onRetry?: () => void;
  readonly onBackToProjects?: () => void;
  readonly onLogin?: () => void;
}

export function ProjectAccessView({
  accessState,
  onRetry,
  onBackToProjects,
  onLogin,
}: ProjectAccessViewProps) {
  return (
    <div className="project-access-page" data-testid="project-access-page">
      <header className="project-access-header">
        <div className="project-access-brand">
          <span aria-hidden="true">▥</span> TaskTracker
        </div>
        <nav className="project-access-breadcrumb" aria-label="Breadcrumb">
          Projects / Project access and safe navigation
        </nav>
      </header>

      <main className="project-access-content">
        {accessState === 'checking' && (
          <div
            className="project-access-card project-access-card--checking"
            role="status"
            aria-busy="true"
            aria-live="polite"
            data-testid="project-access-checking"
          >
            <h1 className="project-access-title">Checking access</h1>
            <p className="project-access-subtitle">Please wait…</p>
            <div className="project-access-status-box">
              <p className="project-access-status-line">Loading your permitted workspace…</p>
              <p className="project-access-status-detail">
                Private boards and tasks remain hidden until access is confirmed.
              </p>
            </div>
          </div>
        )}

        {accessState === 'unavailable' && (
          <div
            className="project-access-card project-access-card--unavailable"
            role="alert"
            data-testid="project-access-unavailable"
          >
            <span className="visually-hidden" data-testid="board-not-found">Board not found</span>
            <h1 className="project-access-title">Project unavailable</h1>
            <p className="project-access-subtitle">You don’t have access, or this project is unavailable.</p>
            <p className="project-access-guidance">
              Return to your projects. If you need access, contact a project Owner.
            </p>
            <div className="project-access-actions">
              <button
                type="button"
                className="project-access-btn-primary"
                onClick={onBackToProjects}
                data-testid="project-access-back-btn"
              >
                Back to projects
              </button>
            </div>
          </div>
        )}

        {accessState === 'revoked' && (
          <div
            className="project-access-card project-access-card--revoked"
            role="alert"
            data-testid="project-access-revoked"
          >
            <h1 className="project-access-title">Your project access has changed</h1>
            <p className="project-access-subtitle">You no longer have access to this project.</p>
            <p className="project-access-guidance">
              Return to your projects. If you need access, contact a project Owner.
            </p>
            <div className="project-access-actions">
              <button
                type="button"
                className="project-access-btn-primary"
                onClick={onBackToProjects}
                data-testid="project-access-back-btn"
              >
                Back to projects
              </button>
            </div>
          </div>
        )}

        {accessState === 'session_expired' && (
          <div
            className="project-access-card project-access-card--session-expired"
            role="alert"
            data-testid="project-access-session-expired"
          >
            <h1 className="project-access-title">Your session has expired</h1>
            <p className="project-access-subtitle">Log in again to continue.</p>
            <p className="project-access-guidance">
              Private project content is hidden until your session and membership are verified.
            </p>
            <div className="project-access-actions">
              <button
                type="button"
                className="project-access-btn-primary"
                onClick={onLogin}
                data-testid="project-access-login-btn"
              >
                Log in
              </button>
            </div>
          </div>
        )}

        {accessState === 'connection_error' && (
          <div
            className="project-access-card project-access-card--connection-error"
            role="alert"
            data-testid="project-access-connection-error"
          >
            <span className="visually-hidden" data-testid="board-error">Failed to load board</span>
            <h1 className="project-access-title">Couldn’t connect</h1>
            <p className="project-access-subtitle">We couldn’t check project access.</p>
            <div className="project-access-error-box">
              <p className="project-access-error-line">Check your connection and try again.</p>
            </div>
            <div className="project-access-actions">
              <button
                type="button"
                className="project-access-btn-primary"
                onClick={onRetry}
                data-testid="project-access-retry-btn"
              >
                Try again
              </button>
              <button
                type="button"
                className="project-access-btn-secondary"
                onClick={onBackToProjects}
                data-testid="project-access-back-btn"
              >
                Back to projects
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
