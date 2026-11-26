import type { ProjectMembersState } from '../../hooks/useProjectMembers';
import { AccessProblem, CheckingAccess } from '../access/AccessScreens';

/**
 * What every members screen shows until the backend has confirmed membership: the neutral loading
 * shell, a generic refusal, or a problem that isn't a refusal. Never the project's name or members.
 */
export function MembersUnavailable({
  state,
  onRetry,
}: {
  state: Exclude<ProjectMembersState, { status: 'ready' }>;
  onRetry: () => void;
}) {
  if (state.status === 'loading') return <CheckingAccess />;
  return <AccessProblem error={state.error} revoked={state.revoked} onRetry={onRetry} />;
}
