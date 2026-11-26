export interface WorkloadSkeletonProps {
  readonly projectName?: string;
}

export function WorkloadSkeleton({ projectName = 'Project' }: WorkloadSkeletonProps) {
  return (
    <div
      className="workload-skeleton-container"
      role="status"
      aria-label="Loading workload…"
      data-testid="workload-skeleton"
    >
      <header className="workload-card-header">
        <h3 className="workload-card-title">Team workload</h3>
        <p className="workload-card-subtitle">{projectName} · Open tasks</p>
      </header>

      <div className="workload-loading-box" data-testid="workload-loading-box">
        Loading current assignments…
      </div>

      <div className="workload-skeleton-cards">
        <div className="workload-skeleton-card" />
        <div className="workload-skeleton-card" />
        <div className="workload-skeleton-card" />
      </div>
    </div>
  );
}
