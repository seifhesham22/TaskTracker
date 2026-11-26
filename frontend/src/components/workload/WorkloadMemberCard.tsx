import type React from 'react';
import type { MemberWorkloadItem } from '../../domain/models';

export interface WorkloadMemberCardProps {
  readonly member: MemberWorkloadItem;
  readonly maxCount: number;
  readonly onClick: () => void;
}

function getInitials(name: string): string {
  if (!name.trim()) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function WorkloadMemberCard({ member, maxCount, onClick }: WorkloadMemberCardProps) {
  const initials = getInitials(member.userName);
  const percentage = maxCount > 0 ? Math.min(100, Math.round((member.openTaskCount / maxCount) * 100)) : 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className="workload-member-card"
      role="button"
      tabIndex={0}
      data-testid={`workload-member-card-${member.userId}`}
      aria-label={`${member.userName}, ${member.openTaskCount} open tasks`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <div className="workload-member-top-row">
        <div className="workload-avatar" aria-hidden="true">
          {initials}
        </div>
        <strong className="workload-member-name">{member.userName}</strong>
        <span className="workload-member-count" data-testid={`workload-member-count-${member.userId}`}>
          {member.openTaskCount} open
        </span>
      </div>

      <div className="workload-bar-track" aria-hidden="true">
        <div
          className="workload-bar-fill"
          style={{ width: `${percentage}%` }}
          data-testid={`workload-bar-fill-${member.userId}`}
        />
      </div>
    </div>
  );
}
