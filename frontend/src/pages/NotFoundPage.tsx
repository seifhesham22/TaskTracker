import { Link } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import './pages.css';

export function NotFoundPage() {
  return (
    <div className="page page--centered">
      <p className="page__code" aria-hidden="true">404</p>
      <PageHeader title="Page not found">
        <p>The page you are looking for doesn't exist or has been moved.</p>
      </PageHeader>
      <div className="page__actions">
        <Link to="/" id="not-found-home" className="button button--primary">
          Back to home
        </Link>
      </div>
    </div>
  );
}
