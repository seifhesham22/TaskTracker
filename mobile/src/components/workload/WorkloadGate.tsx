import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useBoardRepository } from '../../data/BoardRepositoryContext';
import type { ProjectDetails } from '../../domain/models';
import { WORKLOAD_UNAVAILABLE_TEXT, WORKLOAD_UNAVAILABLE_TITLE } from '../../domain/workload';
import { useAccessCheckedLoad } from '../../hooks/useAccessCheckedLoad';
import { useWorkload } from '../../hooks/useWorkload';
import { colors } from '../../theme/tokens';
import { AccessDenied, AccessProblem, CheckingAccess } from '../access/AccessScreens';
import { TaskScreen } from '../task/TaskScreen';
import { Button } from '../ui';

/**
 * US-29: the project, read with the same membership check as every project screen, then its
 * workload. Only the owner gets the workload (the backend's rule for `workload`); for anyone else
 * the request isn't sent and the screen says the view is unavailable. The backend checks again.
 */
export function useProjectWorkload(projectId: string | undefined) {
  const repository = useBoardRepository();
  const load = useCallback(() => repository.getProject(projectId ?? ''), [repository, projectId]);
  const access = useAccessCheckedLoad(projectId, load);
  const project = access.state.status === 'ready' ? access.state.data : null;
  const isOwner = project?.role === 'OWNER';
  const { state: workload, refresh } = useWorkload(projectId, { enabled: isOwner, onRoleRefused: access.refresh });

  /** Pull-to-refresh: membership and role, then the counts. */
  const refreshAll = () => {
    access.refresh();
    refresh();
  };

  // What to show instead of the workload: the access screens, or “Workload unavailable”.
  let gate: React.ReactElement | null = null;
  if (access.state.status === 'checking') gate = <CheckingAccess />;
  else if (access.state.status === 'denied') gate = <AccessDenied denial={access.state.denial} />;
  else if (access.state.status === 'unverified') gate = <AccessProblem error={access.state.error} onRetry={access.retry} />;
  else if (workload.status === 'denied') gate = <AccessDenied denial={workload.revoked ? 'revoked' : 'unavailable'} />;
  else if (!isOwner || workload.status === 'unavailable') gate = <WorkloadUnavailable projectId={projectId ?? ''} />;

  return { gate, project: project as ProjectDetails | null, workload, retry: refresh, refresh: refreshAll };
}

/** As in the design: the view is for the owner; others get a way back to the project. */
function WorkloadUnavailable({ projectId }: { projectId: string }) {
  const router = useRouter();
  return (
    <TaskScreen title={WORKLOAD_UNAVAILABLE_TITLE} testID="workload-unavailable">
      <Text style={styles.text}>{WORKLOAD_UNAVAILABLE_TEXT}</Text>
      <Button
        label="Back to project"
        variant="outline"
        size="lg"
        block
        onPress={() => router.replace({ pathname: '/projects/[projectId]', params: { projectId } })}
        testID="back-to-project"
      />
    </TaskScreen>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 14, lineHeight: 20, color: colors.mutedForeground, marginTop: -8 },
});
