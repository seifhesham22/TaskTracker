import { Link, Outlet } from 'react-router';
import { NavBar } from '../components/NavBar';
import './AppLayout.css';

export function AppLayout() {
  return (
    <div className="app-layout">
      <header className="app-layout__header">
        <Link to="/" className="app-layout__brand" aria-label="TaskTracker home">
          <span className="app-layout__logo" aria-hidden="true" />
          <span className="app-layout__brand-name">TaskTracker</span>
        </Link>
        <NavBar />
      </header>

      <main className="app-layout__main">
        <Outlet />
      </main>

      <footer className="app-layout__footer">
        <p>TaskTracker &middot; Web client</p>
      </footer>
    </div>
  );
}
