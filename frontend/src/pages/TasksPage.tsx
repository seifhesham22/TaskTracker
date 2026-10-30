import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import './pages.css';

export function TasksPage() {
  return (
    <div className="page">
      <PageHeader eyebrow="Workspace" title="Tasks">
        <p>Your team's tasks will appear here once the tasks API is available.</p>
      </PageHeader>

      <Card className="page__empty">
        <p className="page__empty-title">No tasks yet</p>
        <p className="page__muted">This page is a placeholder for the upcoming task list.</p>
      </Card>
    </div>
  );
}
