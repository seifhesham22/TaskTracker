import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import './pages.css';

export function AboutPage() {
  return (
    <div className="page">
      <PageHeader eyebrow="Project" title="About TaskTracker">
        <p>A task tracker built by a small team as a web app, a mobile app and a shared API.</p>
      </PageHeader>

      <div className="page__grid">
        <Card title="Web">
          <p className="page__muted">React, TypeScript and Vite, in the <code>/frontend</code> folder.</p>
        </Card>
        <Card title="Mobile">
          <p className="page__muted">React Native and Expo, in the <code>/mobile</code> folder.</p>
        </Card>
        <Card title="Backend">
          <p className="page__muted">ASP.NET Core and PostgreSQL, in the <code>/backend</code> folder.</p>
        </Card>
      </div>
    </div>
  );
}
