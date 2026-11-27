import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { TaskScreen } from '../../../../components/task/TaskScreen';
import { Button } from '../../../../components/ui';
import { useProjectWorkload } from '../../../../components/workload/WorkloadGate';
import {
  ErrorNote,
  MemberCard,
  Note,
  WorkloadError,
  WorkloadLoading,
  workloadStyles as styles,
} from '../../../../components/workload/WorkloadParts';
import {
  COUNTS_EXCLUDE_COMPLETED,
  NO_OPEN_WORK,
  WORKLOAD_REFRESH_FAILED,
  hasOpenWork,
  openTasksLabel,
} from '../../../../domain/workload';

/**
 * US-29: the owner compares how many open tasks each member of the project has. The counts,
 * the order (most open tasks first, then by name) and the unassigned group are the backend's.
 */
export default function TeamWorkloadScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const { gate, project, workload, retry, refresh } = useProjectWorkload(projectId);
  if (gate || !project) return gate;

  const openMember = (userId: string) =>
    router.push({ pathname: '/projects/[projectId]/workload/member/[userId]', params: { projectId: project.id, userId } });
  const openUnassigned = () =>
    router.push({ pathname: '/projects/[projectId]/workload/unassigned', params: { projectId: project.id } });
  const backToProject = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/projects/[projectId]', params: { projectId: project.id } });
  };

  return (
    <TaskScreen
      title="Team workload"
      refreshing={workload.status === 'ready' && workload.refreshing}
      onRefresh={workload.status === 'ready' ? refresh : undefined}
      testID="workload-screen"
    >
      <Text style={styles.subtitle}>{`${project.name} · Open tasks`}</Text>

      {workload.status === 'loading' ? (
        <WorkloadLoading />
      ) : workload.status === 'error' ? (
        <WorkloadError message={workload.message} onRetry={retry} />
      ) : workload.status === 'ready' ? (
        <View style={styles.list}>
          {workload.stale ? <ErrorNote testID="workload-stale">{WORKLOAD_REFRESH_FAILED}</ErrorNote> : null}
          {hasOpenWork(workload.data) ? (
            <>
              <Text style={styles.meta}>{COUNTS_EXCLUDE_COMPLETED}</Text>
              {workload.data.members.map((member) => (
                <MemberCard
                  key={member.userId}
                  member={member}
                  max={Math.max(0, ...workload.data.members.map((m) => m.openTaskCount))}
                  showBar
                  onPress={() => openMember(member.userId)}
                />
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Unassigned work, ${openTasksLabel(workload.data.unassigned.length)}, separate from member totals`}
                onPress={openUnassigned}
                style={styles.card}
                testID="unassigned-summary"
              >
                <Text style={styles.groupTitle}>Unassigned work</Text>
                <Text style={styles.cardText}>
                  {`${openTasksLabel(workload.data.unassigned.length)} · Separate from member totals`}
                </Text>
              </Pressable>
              <Button
                label="View unassigned work"
                variant="outline"
                size="lg"
                block
                onPress={openUnassigned}
                testID="view-unassigned"
              />
            </>
          ) : (
            <>
              <Note testID="workload-empty">{NO_OPEN_WORK}</Note>
              {workload.data.members.map((member) => (
                <MemberCard key={member.userId} member={member} max={0} showBar={false} onPress={() => openMember(member.userId)} />
              ))}
              <Button label="Back to project" variant="outline" size="lg" block onPress={backToProject} testID="back-to-project" />
            </>
          )}
        </View>
      ) : null}
    </TaskScreen>
  );
}
