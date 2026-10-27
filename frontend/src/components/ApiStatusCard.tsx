import { appConfig } from '../config/AppConfig';
import { useApiStatus, type ApiStatusState } from '../hooks/useApiStatus';
import { Card } from './Card';
import './ApiStatusCard.css';

const statusLabels: Record<ApiStatusState, string> = {
  checking: 'Checking…',
  online: 'Online',
  offline: 'Unreachable',
  unconfigured: 'Not configured',
};

const statusHints: Record<ApiStatusState, string> = {
  checking: 'Contacting the backend.',
  online: 'The backend responded.',
  offline: 'Start the backend (docker compose up) and try again.',
  unconfigured: 'Set VITE_API_URL in frontend/.env and restart the dev server.',
};

/** Shows whether the backend is reachable, using the API layer. */
export function ApiStatusCard() {
  const { status, refresh } = useApiStatus();

  return (
    <Card title="Backend connection" className="api-status-card">
      <div className="api-status-card__row">
        <span className={`api-status-card__badge api-status-card__badge--${status}`} role="status">
          <span className="api-status-card__dot" aria-hidden="true" />
          {statusLabels[status]}
        </span>
        <button
          type="button"
          id="api-status-refresh"
          className="button button--ghost"
          onClick={refresh}
          disabled={status === 'checking'}
        >
          Check again
        </button>
      </div>
      <p className="api-status-card__hint">{statusHints[status]}</p>
      <dl className="api-status-card__meta">
        <dt>API URL</dt>
        <dd>
          <code>{appConfig.apiBaseUrl ?? '—'}</code>
        </dd>
      </dl>
    </Card>
  );
}
