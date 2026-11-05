import { ColumnCategory } from '../../domain/models';

export interface StatusIconProps {
  readonly category: ColumnCategory;
  readonly color?: string | null;
  readonly className?: string;
}

export function StatusIcon({ category, className = '' }: StatusIconProps) {
  switch (category) {
    case ColumnCategory.Backlog:
      return <img src="/assets/5bfa2.svg" alt="" width="16" height="16" className={className} />;
    case ColumnCategory.ToDo:
      return <img src="/assets/ceece.svg" alt="" width="16" height="16" className={className} />;
    case ColumnCategory.InProgress:
      return <img src="/assets/09336.svg" alt="" width="16" height="16" className={className} />;
    case ColumnCategory.Done:
      return <img src="/assets/704e4.svg" alt="" width="16" height="16" className={className} />;
    default:
      return <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#8A90A0' }} />;
  }
}
