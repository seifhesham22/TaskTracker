import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import type { ProjectDetails } from '../../domain/models';
import {
  MEMBER_GONE,
  WORKLOAD_LIST_PAGE,
  WORKLOAD_REFRESH_FAILED,
  memberTasksTitle,
  openTasksLabel,
  showingLabel,
  type ProjectWorkload,
  type WorkloadTask,
} from '../../domain/workload';
import { TaskScreen } from '../task/TaskScreen';
import { Button } from '../ui';
import { useProjectWorkload } from './WorkloadGate';
import { ErrorNote, Note, WorkloadError, WorkloadLoading, WorkloadTaskRow, workloadStyles as styles } from './WorkloadParts';

/** Which group's tasks: one member's, or the open tasks nobody in the project is assigned to. */
export type WorkloadGroup = { kind: 'member'; userId: string } | { kind: 'unassigned' };

function groupOf(data: ProjectWorkload, group: WorkloadGroup) {
  if (group.kind === 'unassigned') return { title: 'Unassigned work', tasks: data.unassigned, empty: 'No open tasks are unassigned.' };
  const member = data.members.find((m) => m.userId.toLowerCase() === group.userId.toLowerCase());
  if (!member) return null;
  return {
    title: memberTasksTitle(member.userName),
    tasks: member.openTasks,
    empty: `No open tasks are assigned to ${member.userName}.`,
  };
}

/**
 * US-29: a group's open tasks, as the backend's `workload` gives them (in backlog order), read
 * again whenever the screen comes into view, so a task reassigned or completed from its details
 * drops out on return. A long list is shown 20 at a time; the count is always the whole group's.
 */
export function WorkloadTaskList({ projectId, group }: { projectId: string | undefined; group: WorkloadGroup }) {
  const router = useRouter();
  const { gate, project, workload, retry, refresh } = useProjectWorkload(projectId);
  const [shown, setShown] = useState(WORKLOAD_LIST_PAGE);
  if (gate || !project) return gate;

  const backToWorkload = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/projects/[projectId]/workload', params: { projectId: project.id } });
  };
  const back = <Button label="Back to workload" variant="outline" size="lg" block onPress={backToWorkload} testID="back-to-workload" />;

  if (workload.status !== 'ready') {
    return (
      <TaskScreen title={group.kind === 'unassigned' ? 'Unassigned work' : 'Open tasks'} testID="workload-list-screen">
        <Text style={styles.subtitle}>{`${project.name} · Open tasks`}</Text>
        {workload.status === 'error' ? <WorkloadError message={workload.message} onRetry={retry} /> : <WorkloadLoading />}
        {back}
      </TaskScreen>
    );
  }

  const found = groupOf(workload.data, group);
  if (!found) {
    return (
      <TaskScreen title="Open tasks" onRefresh={refresh} refreshing={workload.refreshing} testID="workload-list-screen">
        <Note testID="member-gone">{MEMBER_GONE}</Note>
        {back}
      </TaskScreen>
    );
  }

  const total = found.tasks.length;
  const visible = found.tasks.slice(0, shown);
  return (
    <TaskScreen title={found.title} onRefresh={refresh} refreshing={workload.refreshing} testID="workload-list-screen">
      <Text style={styles.subtitle} testID="workload-list-subtitle">{`${project.name} · ${openTasksLabel(total)}`}</Text>
      <View style={styles.list}>
        {workload.stale ? <ErrorNote testID="workload-stale">{WORKLOAD_REFRESH_FAILED}</ErrorNote> : null}
        {total === 0 ? <Note testID="workload-list-empty">{found.empty}</Note> : null}
        {visible.map((task) => (
          <WorkloadTaskRow
            key={task.id}
            task={task}
            boardName={boardNameOf(project, task)}
            onPress={() => router.push({ pathname: '/tasks/[taskId]', params: { taskId: task.id, boardId: task.boardId } })}
          />
        ))}
        {total > 0 ? <Note testID="workload-showing">{showingLabel(visible.length, total)}</Note> : null}
        {visible.length < total ? (
          <Button
            label="Load more"
            variant="outline"
            size="lg"
            block
            onPress={() => setShown((n) => n + WORKLOAD_LIST_PAGE)}
            testID="workload-load-more"
          />
        ) : null}
        {back}
      </View>
    </TaskScreen>
  );
}

/** The board's name, shown only when the project has more than one board. */
function boardNameOf(project: ProjectDetails, task: WorkloadTask): string | undefined {
  if (project.boards.length < 2) return undefined;
  return project.boards.find((b) => b.id === task.boardId)?.name;
}
