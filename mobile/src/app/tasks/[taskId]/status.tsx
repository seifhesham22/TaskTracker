import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessProblem, CheckingAccess } from '../../../components/access/AccessScreens';
import { ErrorBanner, SuccessBanner, TaskScreen, breadcrumbFor } from '../../../components/task/TaskScreen';
import { Button } from '../../../components/ui';
import {
  ALL_PREREQUISITES_DONE,
  CHECKING_PREREQUISITES,
  COMPLETION_CHECKED_SEPARATELY,
  CURRENT_STATUS,
  TASK_STARTED,
  VERIFY_FAILED,
  blockerDetail,
  blocksTask,
  cantStart,
  isActiveCategory,
  moveReverted,
  movedTo,
  type Blocker,
} from '../../../domain/blockers';
import type { BoardColumn } from '../../../domain/models';
import { useTaskDetails } from '../../../hooks/useTaskDetails';
import { useTaskStatusChange } from '../../../hooks/useTaskStatusChange';
import { colors, radius } from '../../../theme/tokens';

const READ_ONLY = 'Only Owners and Writers can change the status.';

const actionLabel = (column: BoardColumn) =>
  column.category === 'IN_PROGRESS' ? 'Start task' : column.category === 'DONE' ? 'Complete task' : `Move to ${column.name}`;

/**
 * US-17: a task's status, and starting it only when every task blocking it is done. Opened from
 * Task details, from a move the board couldn't make (`reverted`), or from another task it blocks
 * (`blocks`: that task's key, to go back to it).
 */
export default function TaskStatusScreen() {
  const { taskId, boardId, reverted, blocks } = useLocalSearchParams<{
    taskId: string;
    boardId: string;
    reverted?: string;
    blocks?: string;
  }>();
  const router = useRouter();
  const details = useTaskDetails(boardId, taskId);
  const status = useTaskStatusChange({ boardId, taskId });
  const [chosen, setChosen] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Opened after a refused move: said once, until the task moves. */
  const [showReverted, setShowReverted] = useState(reverted === '1');
  const { state } = details;

  const backToBoard = () => router.dismissTo({ pathname: '/boards/[boardId]', params: { boardId } });
  const openBlocker = (blocker: Blocker) =>
    router.push({
      pathname: '/tasks/[taskId]/status',
      params: { taskId: blocker.id, boardId: blocker.boardId ?? boardId, blocks: state.status === 'ready' ? state.details.task.readableId : undefined },
    });

  if (state.status === 'loading') return <CheckingAccess />;
  if (state.status === 'error') return <AccessProblem error={state.error} revoked={state.revoked} onRetry={details.retry} />;

  const { task, projectName, columns, canEdit } = state.details;
  const current = columns.find((c) => c.id === task.columnId);
  const started = current ? isActiveCategory(current.category) : false;
  // Proposed: start the task, if it hasn't started yet.
  const proposed = started ? null : (columns.find((c) => c.category === 'IN_PROGRESS')?.id ?? null);
  const targetId = chosen ?? proposed;
  const target = columns.find((c) => c.id === targetId && c.id !== task.columnId) ?? null;
  const { check, saving } = status;

  const submit = async () => {
    if (!target) return;
    setError(null);
    setNotice(null);
    const outcome = await status.move(target);
    if (!outcome) return;
    if (outcome.status === 'moved') {
      // Shown only once the task has been read again: the status is the backend's.
      await details.recheck();
      setShowReverted(false);
      setChosen(null);
      setNotice(target.category === 'IN_PROGRESS' ? TASK_STARTED : target.category === 'DONE' ? 'Task completed' : movedTo(target.name));
    } else if (outcome.status === 'noAccess') {
      await details.recheck();
    } else if (outcome.status === 'failed') {
      setError(outcome.message);
    }
    // blocked / unverified: shown by the check itself; nothing was moved.
  };

  return (
    <TaskScreen title={task.title} testID="task-status-screen">
      <Text style={styles.subtitle}>{breadcrumbFor(projectName, task.readableId)}</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Status</Text>
        <View style={styles.value} accessible accessibilityLabel={`Status: ${task.columnName}`} testID="status-value">
          <Text style={styles.valueText}>{task.columnName}</Text>
        </View>
      </View>

      {blocks ? (
        <>
          <View style={styles.note} testID="blocks-note">
            <Text style={styles.noteText}>{blocksTask(blocks)}</Text>
          </View>
          <Button label="Back to blocked task" variant="outline" size="lg" block style={styles.button} onPress={() => router.back()} testID="back-to-blocked" />
        </>
      ) : null}

      {notice ? <SuccessBanner>{notice}</SuccessBanner> : null}
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}

      {check.status === 'checking' ? (
        <>
          <View style={styles.note} accessibilityRole="progressbar" accessibilityLiveRegion="polite" testID="checking-prerequisites">
            <Text style={styles.noteText}>{CHECKING_PREREQUISITES}</Text>
          </View>
          {canEdit ? <Button label="Checking…" size="lg" block disabled style={styles.button} testID="status-checking" /> : null}
        </>
      ) : check.status === 'unverified' ? (
        <>
          <ErrorBanner>{VERIFY_FAILED}</ErrorBanner>
          <Button label="Try again" size="lg" block style={styles.button} onPress={() => void status.recheck()} testID="check-again" />
          <Button label="Back to board" variant="outline" size="lg" block style={styles.button} onPress={backToBoard} testID="back-to-board" />
        </>
      ) : check.status === 'blocked' ? (
        <>
          <ErrorBanner>{cantStart(check.blockers.length)}</ErrorBanner>
          <View style={styles.list} testID="blocker-list">
            {check.blockers.map((blocker) => (
              <View key={blocker.id} style={styles.blocker} testID={`blocker-${blocker.id}`}>
                <View style={styles.blockerText}>
                  <Text style={styles.blockerTitle}>
                    {blocker.readableId} · {blocker.title}
                  </Text>
                  <Text style={styles.blockerDetail}>{blockerDetail(blocker, task.readableId)}</Text>
                </View>
                <Button
                  label="Open blocker"
                  variant="outline"
                  accessibilityLabel={`Open blocker ${blocker.readableId}, ${blocker.title}`}
                  onPress={() => openBlocker(blocker)}
                  testID={`open-blocker-${blocker.id}`}
                />
              </View>
            ))}
          </View>
          {showReverted && !started ? (
            <View style={styles.note} testID="move-reverted">
              <Text style={styles.noteText}>{moveReverted(task.readableId, task.columnName)}</Text>
            </View>
          ) : null}
          <Button label="Check again" size="lg" block style={styles.button} onPress={() => void status.recheck()} testID="check-again" />
          <Button label="Back to board" variant="outline" size="lg" block style={styles.button} onPress={backToBoard} testID="back-to-board" />
        </>
      ) : (
        <>
          {check.hadBlockers && !started ? (
            <View style={styles.note} testID="prerequisites-done">
              <Text style={styles.noteText}>{ALL_PREREQUISITES_DONE}</Text>
            </View>
          ) : null}
          {canEdit ? (
            <>
              <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel="Status">
                {columns.map((column) => (
                  <StatusOption
                    key={column.id}
                    column={column}
                    current={column.id === task.columnId}
                    selected={column.id === (target?.id ?? task.columnId)}
                    disabled={saving}
                    onPress={() => setChosen(column.id)}
                  />
                ))}
              </View>
              <Button
                label={saving ? 'Saving…' : target ? actionLabel(target) : 'Start task'}
                size="lg"
                block
                loading={saving}
                disabled={!target}
                style={styles.button}
                onPress={() => void submit()}
                testID="status-submit"
              />
            </>
          ) : (
            <Text style={styles.hint} testID="status-read-only">
              {READ_ONLY}
            </Text>
          )}
          <Button label="Back to board" variant="outline" size="lg" block disabled={saving} style={styles.button} onPress={backToBoard} testID="back-to-board" />
        </>
      )}
    </TaskScreen>
  );
}

function StatusOption({
  column,
  current,
  selected,
  disabled,
  onPress,
}: {
  column: BoardColumn;
  current: boolean;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const detail = current ? CURRENT_STATUS : column.category === 'DONE' ? COMPLETION_CHECKED_SEPARATELY : null;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={[column.name, detail].filter(Boolean).join(', ')}
      disabled={disabled}
      onPress={onPress}
      style={[styles.option, selected && styles.optionSelected]}
      testID={`status-option-${column.id}`}
    >
      <View style={styles.optionText}>
        <Text style={styles.optionTitle}>{column.name}</Text>
        {detail ? <Text style={styles.optionDetail}>{detail}</Text> : null}
      </View>
      <View style={styles.radio}>{selected ? <View style={styles.radioDot} /> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
  field: { gap: 8 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.foreground },
  value: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  valueText: { fontSize: 16, lineHeight: 22, color: colors.foreground },
  note: { padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.muted },
  noteText: { fontSize: 14, lineHeight: 20, color: colors.foreground },
  hint: { fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
  list: { gap: 8 },
  blocker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  blockerText: { flex: 1, gap: 2 },
  blockerTitle: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.foreground },
  blockerDetail: { fontSize: 13, lineHeight: 18, color: colors.mutedForeground },
  option: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  optionSelected: { borderColor: colors.foreground, backgroundColor: colors.muted },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.foreground },
  optionDetail: { fontSize: 13, lineHeight: 18, color: colors.mutedForeground },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.foreground, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.foreground },
  button: { height: 48 },
});
