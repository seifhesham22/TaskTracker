export interface WorkloadAccessRestrictedViewProps {
  readonly onBack: () => void;
}

export function WorkloadAccessRestrictedView({ onBack }: WorkloadAccessRestrictedViewProps) {
  return (
    <div
      className="workload-restricted-container"
      data-testid="workload-access-restricted"
      role="alert"
    >
      <h3 className="workload-card-title">Workload unavailable</h3>
      <p className="workload-restricted-text">
        Only authorized project roles can open this view.
      </p>
      <button
        type="button"
        className="workload-btn-secondary"
        data-testid="workload-restricted-back-btn"
        onClick={onBack}
      >
        Back to project
      </button>
    </div>
  );
}
