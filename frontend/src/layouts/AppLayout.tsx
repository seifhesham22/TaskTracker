import { Link, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../auth/useAuth';
import { ActiveProjectProvider } from '../context/ActiveProjectContext';
import { useActiveProject } from '../context/activeProjectContextDef';
import './AppLayout.css';

function getInitials(email?: string | null): string {
  if (!email) return 'AD';
  const prefix = email.split('@')[0];
  if (!prefix) return 'AD';
  const letters = prefix.replace(/[^a-zA-Z]/g, '');
  if (letters.length >= 2) {
    return letters.slice(0, 2).toUpperCase();
  }
  return prefix.slice(0, 2).toUpperCase();
}

function AppLayoutContent() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { activeProjectId, activeBoardId } = useActiveProject();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const initials = getInitials(user?.email);

  // Dynamic contextual routes: point to the project/board currently on screen
  const tasksUrl = activeBoardId
    ? `/boards/${activeBoardId}`
    : activeProjectId
      ? `/tasks?projectId=${activeProjectId}`
      : '/tasks';

  const backlogUrl = activeProjectId
    ? `/projects/${activeProjectId}/backlog`
    : '/backlog';

  return (
    <div className="app-layout">
      <header className="app-header">
        <Link to="/" className="brand-link" aria-label="TaskTracker home">
          <span className="brand-mark">
            <img src="/assets/d3037.svg" alt="" width="16" height="16" />
          </span>
          <strong className="brand-name">TaskTracker</strong>
        </Link>

        <nav className="app-nav" aria-label="Primary navigation">
          <Link to="/projects" className="app-nav-link" id="nav-projects-link">
            Projects
          </Link>
          <Link
            to={tasksUrl}
            className="app-nav-link"
            id="nav-tasks-link"
            data-testid="nav-tasks-link"
          >
            Tasks
          </Link>
          <Link
            to={backlogUrl}
            className="app-nav-link"
            id="nav-backlog-link"
            data-testid="nav-backlog-link"
          >
            Backlog
          </Link>
        </nav>

        <div className="app-user-section">
          <span className="app-avatar" aria-label="Current user avatar">
            {initials}
          </span>
          <button
            type="button"
            className="app-logout-btn"
            onClick={handleLogout}
            aria-label="Log out"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

export function AppLayout() {
  return (
    <ActiveProjectProvider>
      <AppLayoutContent />
    </ActiveProjectProvider>
  );
}
