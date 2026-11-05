import { Link, Outlet } from 'react-router';
import './AppLayout.css';

export function AppLayout() {
  return (
    <div className="app-layout">
      <header className="app-header">
        <Link to="/" className="brand-link" aria-label="TaskTracker home">
          <span className="brand-mark">
            <img src="/assets/d3037.svg" alt="" width="16" height="16" />
          </span>
          <strong className="brand-name">TaskTracker</strong>
        </Link>
        <span className="app-avatar" aria-label="Current user avatar">AD</span>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
