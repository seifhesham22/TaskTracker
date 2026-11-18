import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BoardState } from '../../../components/board/BoardState';
import { SuccessBanner, TaskScreen, breadcrumbFor } from '../../../components/task/TaskScreen';
import { Button } from '../../../components/ui';
import { formatFullDate, isoToDateKey } from '../../../domain/format';
import { PRIORITY_LABELS } from '../../../domain/models';
import { useTaskDetails } from '../../../hooks/useTaskDetails';
import { colors } from '../../../theme/tokens';

const dateLabel = (iso: string | null | undefined) => (iso ? formatFullDate(isoToDateKey(iso)) : 'Not set');

/** A task's title, description, priority and dates, as the backend has them, with Edit task. */
export default function TaskDetailsScreen() {
  const { taskId, boardId, updated } = useLocalSearchParams<{ taskId: string; boardId: string; updated?: string }>();
  const router = useRouter();
  const { state, retry } = useTaskDetails(boardId, taskId);

  const close = () => {
    if (router.canGoBack()) router.back();
    else if (boardId) router.replace({ pathname: '/boards/[boardId]', params: { boardId } });
    else router.replace('/');
  };

  if (state.status !== 'ready') {
    return (
      <TaskScreen title="Task details" onClose={close} testID="task-details-screen">
        {state.status === 'loading' ? (
          <View style={styles.state}>
            <ActivityIndicator accessibilityLabel="Loading task" />
          </View>
        ) : (
          <View style={styles.state}>
            {state.error.kind === 'notFound' ? (
              <BoardState type="notfound" title="Task not found" description={state.error.message} action="Go back" onAction={close} />
            ) : (
              <BoardState type="error" title="Couldn’t load this task" description={state.error.message} onAction={retry} />
            )}
          </View>
        )}
      </TaskScreen>
    );
  }

  const { task, projectName } = state.details;
  return (
    <TaskScreen
      title="Task details"
      breadcrumb={breadcrumbFor(projectName, task.readableId)}
      onClose={close}
      testID="task-details-screen"
    >
      {updated === '1' ? <SuccessBanner>Task updated</SuccessBanner> : null}

      <View style={styles.summary}>
        <Text style={styles.title} testID="task-title">
          {task.title}
        </Text>
        {task.description ? (
          <Text style={styles.description} testID="task-description">
            {task.description}
          </Text>
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
      </View>

      <Button
        label="Edit task"
        variant="outline"
        size="lg"
        block
        onPress={() => router.push({ pathname: '/tasks/[taskId]/edit', params: { taskId: task.id, boardId } })}
        testID="edit-task-button"
      />
    </TaskScreen>
  );
}

const styles = StyleSheet.create({
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  summary: { gap: 8 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.foreground },
  description: { fontSize: 15, lineHeight: 22, color: colors.mutedForeground },
  row: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.foreground,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
