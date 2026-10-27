import { Link } from 'react-router';
import { ApiStatusCard } from '../components/ApiStatusCard';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import './pages.css';

export function HomePage() {
  return (
    <div className="page">
      <PageHeader eyebrow="Welcome" title="Plan, track and ship your team's work">
        <p>
          TaskTracker keeps every task, owner and deadline in one place. This web client is the
          starting point for the features coming next.
        </p>
      </PageHeader>

      <div className="page__actions">
        <Link to="/tasks" id="home-cta-tasks" className="button button--primary">
          Go to tasks
        </Link>
        <Link to="/about" id="home-cta-about" className="button button--ghost">
          About the project
        </Link>
      </div>

      <div className="page__grid">
        <ApiStatusCard />
        <Card title="What's here">
          <ul className="page__list">
            <li>Routing with a not-found fallback</li>
            <li>An API layer configured through <code>VITE_API_URL</code></li>
            <li>Shared layout, design tokens and components</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
