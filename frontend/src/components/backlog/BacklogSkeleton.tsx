export function BacklogSkeleton() {
  return (
    <div className="backlog-skeleton-wrapper" role="status" aria-label="Loading backlog…">
      <p className="backlog-loading-text">Loading backlog…</p>
      <div className="backlog-skeleton-item" aria-hidden="true" />
      <div className="backlog-skeleton-item" aria-hidden="true" />
      <div className="backlog-skeleton-item" aria-hidden="true" />
    </div>
  );
}
