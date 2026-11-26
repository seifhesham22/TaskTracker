import type React from 'react';
import type { MemberWorkloadItem } from '../../domain/models';
import { WorkloadMemberCard } from './WorkloadMemberCard';

export interface WorkloadComparisonListProps {
  readonly members: readonly MemberWorkloadItem[];
  readonly unassignedCount: number;
  readonly onSelectMember: (userId: string) => void;
  readonly onSelectUnassigned: () => void;
}

export function WorkloadComparisonList({
  members,
  unassignedCount,
  onSelectMember,
  onSelectUnassigned,
}: WorkloadComparisonListProps) {
  const maxCount = members.reduce((max, m) => Math.max(max, m.openTaskCount), 0);

  const handleUnassignedKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectUnassigned();
    }
  };

  const topMember = members[0];

  return (
    <div className="workload-comparison-list" data-testid="workload-comparison-list">
      {/* Member cards */}
      <div className="workload-members-group" role="list" aria-label="Member workload counts">
        {members.map((member) => (
          <WorkloadMemberCard
            key={member.userId}
            member={member}
            maxCount={maxCount}
            onClick={() => onSelectMember(member.userId)}
          />
        ))}
      </div>

      {/* Unassigned work card */}
      <div
        className="workload-unassigned-card"
        role="button"
        tabIndex={0}
        data-testid="workload-unassigned-card"
        aria-label={`Unassigned work, ${unassignedCount} open tasks`}
        onClick={onSelectUnassigned}
        onKeyDown={handleUnassignedKeyDown}
      >
        <div className="workload-unassigned-info">
          <strong className="workload-unassigned-title">Unassigned work</strong>
          <p className="workload-unassigned-subtitle">
            {unassignedCount} {unassignedCount === 1 ? 'open task' : 'open tasks'} · Separate from member totals
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="workload-actions">
        <button
          type="button"
          className="workload-btn-primary"
          data-testid="workload-view-member-tasks-btn"
          disabled={!topMember}
          onClick={() => {
            if (topMember) onSelectMember(topMember.userId);
          }}
        >
          View member tasks
        </button>

        <button
          type="button"
          className="workload-btn-secondary"
          data-testid="workload-view-unassigned-btn"
          onClick={onSelectUnassigned}
        >
          View unassigned work
        </button>
      </div>
    </div>
  );
}
