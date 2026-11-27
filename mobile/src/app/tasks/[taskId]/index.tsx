import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessProblem, CheckingAccess } from '../../../components/access/AccessScreens';
import { RelationBox } from '../../../components/task/Dependencies';
import { IncompleteSubtasks } from '../../../components/task/IncompleteSubtasks';
import { StatusChip, SubtaskList } from '../../../components/task/SubtaskList';
import { ErrorBanner, SuccessBanner, TaskScreen, breadcrumbFor } from '../../../components/task/TaskScreen';
import { Button } from '../../../components/ui';
import { useBoardRepository } from '../../../data/BoardRepositoryContext';
import {
  NO_DONE_COLUMN,
  remainingSubtasks,
  toCompleteTaskFailure,
  type IncompleteSubtask,
} from '../../../domain/completeTask';
import { UNASSIGNED, assigneeLabel, currentAssignees } from '../../../domain/assignee';
import { countLabel } from '../../../domain/dependencies';
import { formatFullDate, isoToDateKey } from '../../../domain/format';
import { PRIORITY_LABELS, type Task, type TaskDetails } from '../../../domain/models';
import { isDone } from '../../../domain/subtask';
import { useTaskDetails } from '../../../hooks/useTaskDetails';
import { colors, radius } from '../../../theme/tokens';

const dateLabel = (iso: string | null | undefined) => (iso ? formatFullDate(isoToDateKey(iso)) : 'Not set');

type Completion =
  | { status: 'idle' }
  | { status: 'completing' }
  /** The backend refused: `listed` is its incompleteSubtasks. */
  | { status: 'blocked'; listed: IncompleteSubtask[] }
  /** The backend accepted: `task` is what it returned. */
  | { status: 'completed'; task: Task }
  | { status: 'failed'; message: string };

/** A task as the backend has it: details, subtasks, Mark complete, Add subtask and Edit task. */
export default function TaskDetailsScreen() {
  const { taskId, boardId, updated, created } = useLocalSearchParams<{
    taskId: string;
    boardId: string;
    updated?: string;
    created?: string;
  }>();
  const router = useRouter();
  // A screen that only shows the task: also checked now and then while it is left open.
  const { state, retry, refresh, reload } = useTaskDetails(boardId, taskId, { poll: true });

  const close = () => {
    if (router.canGoBack()) router.back();
    else if (boardId) router.replace({ pathname: '/boards/[boardId]', params: { boardId } });
    else router.replace('/');
  };

  // Nothing of the task, not even its project, until the backend has confirmed access.
  if (state.status === 'loading') return <CheckingAccess />;
  if (state.status === 'error') return <AccessProblem error={state.error} revoked={state.revoked} onRetry={retry} />;

  return (
    <TaskDetailsView
      key={state.details.task.id}
      details={state.details}
      boardId={boardId}
      banner={updated === '1' ? 'Task updated' : created === '1' ? 'Subtask created' : null}
      reload={reload}
      refreshing={state.refreshing}
      onRefresh={refresh}
      onClose={close}
    />
  );
}

function TaskDetailsView({
  details,
  boardId,
  banner,
  reload,
  refreshing,
  onRefresh,
  onClose,
}: {
  details: TaskDetails;
  boardId: string;
  banner: string | null;
  reload: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const repository = useBoardRepository();
  const { task: saved, projectName, subtasks, parent, doneColumnId } = details;
  const [completion, setCompletion] = useState<Completion>({ status: 'idle' });
  // A ref, not state, so a second tap in the same frame can't send a second request.
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Only a successful response changes the status shown; until then it's the saved one.
  const task = completion.status === 'completed' ? { ...saved, ...completion.task } : saved;
  const openTask = (id: string) => router.push({ pathname: '/tasks/[taskId]', params: { taskId: id, boardId } });

  const complete = async () => {
    if (inFlight.current) return;
    if (!doneColumnId) {
      setCompletion({ status: 'failed', message: NO_DONE_COLUMN });
      return;
    }
    inFlight.current = true;
    setCompletion({ status: 'completing' });
    try {
      // The backend decides: it refuses while any subtask isn't done.
      const completed = await repository.completeTask(saved.id, doneColumnId);
      if (!mounted.current) return;
      setCompletion({ status: 'completed', task: completed });
    } catch (error) {
      if (!mounted.current) return;
      const failure = toCompleteTaskFailure(error);
      setCompletion(
        failure.kind === 'incompleteSubtasks'
          ? { status: 'blocked', listed: failure.subtasks }
          : { status: 'failed', message: failure.message },
      );
    } finally {
      inFlight.current = false;
      // Read the parent and its children again either way, so what's shown is the backend's state.
      if (mounted.current) reload();
    }
  };

  // After a refusal, the open children as of the latest read. Coming back from a child re-reads
  // the parent, so finished children drop off; when none are left, completion can be tried again.
  const remaining = completion.status === 'blocked' ? remainingSubtasks(completion.listed, subtasks) : [];
  const blocked = completion.status === 'blocked' && remaining.length > 0;

  const done = task.status === 'DONE';
  const completing = completion.status === 'completing';
  const allSubtasksDone = subtasks.length > 0 && subtasks.every(isDone);

  return (
    <TaskScreen
      title="Task details"
      breadcrumb={breadcrumbFor(projectName, task.readableId)}
      onClose={onClose}
      closeDisabled={completing}
      refreshing={refreshing}
      onRefresh={onRefresh}
      testID="task-details-screen"
    >
      <StatusChip task={task} />

      {blocked ? (
        <IncompleteSubtasks
          subtasks={remaining}
          known={subtasks}
          onOpen={openTask}
          onBack={() => setCompletion({ status: 'idle' })}
        />
      ) : (
        <>
          {completion.status === 'completed' ? (
            <SuccessBanner>Task completed</SuccessBanner>
          ) : banner ? (
            <SuccessBanner>{banner}</SuccessBanner>
          ) : null}
          {!done && completion.status !== 'completed' && allSubtasksDone ? (
            <View style={styles.note} testID="all-subtasks-done">
              <Text style={styles.noteText}>All subtasks are complete.</Text>
            </View>
          ) : null}

          <View style={styles.summary}>
            <Text style={styles.title} testID="task-title">
              {task.title}
            </Text>
            {task.description ? (
              <Text style={styles.description} testID="task-description">
                {task.description}
              </Text>
            ) : null}
            {parent ? (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`Subtask of ${parent.readableId}, ${parent.title}`}
                onPress={() => openTask(parent.id)}
                hitSlop={8}
                testID="parent-link"
              >
                <Text style={styles.parent}>
                  Subtask of <Text style={styles.parentKey}>{parent.readableId}</Text> · {parent.title}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View>
            <Text style={styles.row} testID="task-priority">
              Priority: {task.priority ? PRIORITY_LABELS[task.priority] : 'None'}
            </Text>
            <Text style={styles.row} testID="task-start-date">
              Start date: {dateLabel(task.startDate)}
            </Text>
            <Text style={styles.row} testID="task-due-date">
              Due date: {dateLabel(task.dueDate)}
            </Text>
            <Text style={styles.row} testID="task-assignee">
              Assignee:{' '}
              {currentAssignees(task, details.members)
                .map((a) => assigneeLabel(a.userName))
                .join(', ') || UNASSIGNED}
            </Text>
          </View>

          <SubtaskList subtasks={subtasks} onOpen={(subtask) => openTask(subtask.id)} />

          <View style={styles.section} testID="dependencies-summary">
            <Text style={styles.sectionHeading} accessibilityRole="header">
              Dependencies
            </Text>
            {(task.blockedBy ?? []).length + (task.blocks ?? []).length === 0 ? (
              <Text style={styles.sectionEmpty}>No dependencies yet.</Text>
            ) : (
              <>
                {(task.blockedBy ?? []).length > 0 ? (
                  <Text style={styles.sectionCount}>{countLabel('Blocked by', task.blockedBy!.length)}</Text>
                ) : null}
                {(task.blockedBy ?? []).map((link) => (
                  <RelationBox key={`by-${link.id}`} first={link} then={task} testID={`details-relation-${link.id}`} />
                ))}
                {(task.blocks ?? []).length > 0 ? (
                  <Text style={styles.sectionCount}>{countLabel('Blocks', task.blocks!.length)}</Text>
                ) : null}
                {(task.blocks ?? []).map((link) => (
                  <RelationBox key={`blocks-${link.id}`} first={task} then={link} testID={`details-relation-${link.id}`} />
                ))}
              </>
            )}
            <Button
              label="Dependencies"
              variant="outline"
              size="lg"
              block
              disabled={completing}
              onPress={() => router.push({ pathname: '/tasks/[taskId]/dependencies', params: { taskId: task.id, boardId } })}
              testID="dependencies-button"
            />
          </View>

          {completion.status === 'failed' ? <ErrorBanner>{completion.message}</ErrorBanner> : null}

          <View style={styles.actions}>
            <Button
              label="Add subtask"
              variant="outline"
              size="lg"
              style={styles.action}
              disabled={completing}
              onPress={() => router.push({ pathname: '/tasks/[taskId]/subtask', params: { taskId: task.id, boardId } })}
              testID="add-subtask-button"
            />
            <Button
              label={done ? 'Completed' : completing ? 'Completing…' : 'Mark complete'}
              size="lg"
              style={styles.action}
              loading={completing}
              disabled={done}
              onPress={() => void complete()}
              testID="mark-complete-button"
            />
          </View>
          <Button
            label="Edit task"
            variant="outline"
            size="lg"
            block
            disabled={completing}
            onPress={() => router.push({ pathname: '/tasks/[taskId]/edit', params: { taskId: task.id, boardId } })}
            testID="edit-task-button"
          />
          <Button
            label="Assignee"
            variant="outline"
            size="lg"
            block
            accessibilityLabel="Task assignee"
            disabled={completing}
            onPress={() => router.push({ pathname: '/tasks/[taskId]/assignee', params: { taskId: task.id, boardId } })}
            testID="assignee-button"
          />
        </>
      )}
    </TaskScreen>
  );
}

const styles = StyleSheet.create({
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  summary: { gap: 8 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.foreground },
  description: { fontSize: 15, lineHeight: 22, color: colors.mutedForeground },
  parent: { fontSize: 14, lineHeight: 20, color: colors.mutedForeground, textDecorationLine: 'underline' },
  parentKey: { fontWeight: '600', color: colors.foreground },
  note: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  noteText: { fontSize: 14, lineHeight: 20, color: colors.foreground },
  actions: { flexDirection: 'row', gap: 8 },
  section: { gap: 10 },
  sectionHeading: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.foreground },
  sectionCount: { fontSize: 13, lineHeight: 18, color: colors.mutedForeground },
  sectionEmpty: { fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
  action: { flex: 1 },
  row: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.foreground,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
