import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AccessDenied, AccessProblem, CheckingAccess } from '../../../components/access/AccessScreens';
import { controlStyles, FieldLabel } from '../../../components/form/fields';
import { AssigneePicker, FilterTasksPanel } from '../../../components/taskSearch/TaskFilterPanels';
import { SuccessBanner, TaskScreen } from '../../../components/task/TaskScreen';
import { Button, Skeleton } from '../../../components/ui';
import { useBoardRepository } from '../../../data/BoardRepositoryContext';
import type { Task } from '../../../domain/models';
import {
  LOADING_TASKS,
  NO_MATCHES,
  NO_TASKS,
  REFRESH_FAILED,
  activeFilterCount,
  boardStatuses,
  criteriaSummary,
  filterChips,
  hasCriteria,
  resultCountLabel,
  taskLine,
  withoutFilter,
  type TaskFilters,
} from '../../../domain/taskFilters';
import { useAccessCheckedLoad } from '../../../hooks/useAccessCheckedLoad';
import { useBoardTaskSearch } from '../../../hooks/useBoardTaskSearch';
import { colors, radius, touchTarget } from '../../../theme/tokens';

type Mode = 'list' | 'filters' | 'assignee';

/**
 * US-36: a board's tasks, searched by title and filtered by status, assignee and priority. The
 * backend's `tasks` query applies all of them; only the tasks the user may see on this board are
 * ever listed, and clearing everything reads the board's full list again.
 */
export default function BoardTasksScreen() {
  const { boardId } = useLocalSearchParams<{ boardId: string }>();
  const router = useRouter();
  const repository = useBoardRepository();
  // The board (its name, project, columns and members), with the same access check as the board.
  const load = useCallback(() => repository.getBoard(boardId ?? ''), [repository, boardId]);
  const access = useAccessCheckedLoad(undefined, load);
  const search = useBoardTaskSearch(boardId);
  const [mode, setMode] = useState<Mode>('list');
  const [draft, setDraft] = useState<TaskFilters>(search.filters);

  if (access.state.status === 'checking') return <CheckingAccess />;
  if (access.state.status === 'denied') return <AccessDenied denial={access.state.denial} />;
  if (access.state.status === 'unverified') return <AccessProblem error={access.state.error} onRetry={access.retry} />;

  const { board } = access.state.data;
  const members = board.members;
  const subtitle = [board.projectName, board.name].filter(Boolean).join(' / ');

  if (mode === 'filters' || mode === 'assignee') {
    return (
      <TaskScreen title="Filter tasks" testID="filter-screen">
        <Text style={styles.subtitle}>{`${board.name} · Changes apply on confirmation`}</Text>
        {mode === 'assignee' ? (
          <AssigneePicker
            value={draft.assignee}
            members={members}
            membersUnavailable={board.membersUnavailable}
            onApply={(assignee) => {
              setDraft({ ...draft, assignee });
              setMode('filters');
            }}
            onCancel={() => setMode('filters')}
          />
        ) : (
          <FilterTasksPanel
            draft={draft}
            onChange={setDraft}
            statuses={boardStatuses(board.columns)}
            members={members}
            onPickAssignee={() => setMode('assignee')}
            onApply={() => {
              search.applyFilters(draft);
              setMode('list');
            }}
            onCancel={() => setMode('list')}
          />
        )}
      </TaskScreen>
    );
  }

  const openFilters = () => {
    setDraft(search.filters);
    setMode('filters');
  };
  const openTask = (task: Task) => router.push({ pathname: '/tasks/[taskId]', params: { taskId: task.id, boardId: board.id } });
  const filterCount = activeFilterCount(search.filters);
  const filtered = hasCriteria(search.search, search.filters);
  const chips = filterChips(search.filters, members);
  const { state } = search;

  return (
    <TaskScreen
      title="Tasks"
      refreshing={state.status === 'ready' && state.refreshing}
      onRefresh={state.status === 'ready' ? search.refresh : undefined}
      testID="board-tasks-screen"
    >
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.field}>
        <FieldLabel>Search task titles</FieldLabel>
        <TextInput
          value={search.searchText}
          onChangeText={search.setSearchText}
          placeholder="Search by title…"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search task titles"
          style={[controlStyles.control, styles.search]}
          testID="task-search"
        />
      </View>
      {state.status !== 'loading' ? (
        <Button
          label={filterCount ? `Filters · ${filterCount}` : 'Filters'}
          variant="outline"
          size="lg"
          block
          accessibilityLabel={filterCount ? `Filters, ${filterCount} active` : 'Filters'}
          onPress={openFilters}
          testID="open-filters"
        />
      ) : null}
      {chips.length ? (
        <View style={styles.chips}>
          {chips.map((chip) => (
            <Pressable
              key={chip.key}
              accessibilityRole="button"
              accessibilityLabel={`Remove filter ${chip.label}`}
              onPress={() => search.applyFilters(withoutFilter(search.filters, chip.key))}
              hitSlop={8}
              style={styles.chip}
              testID={`chip-${chip.key}`}
            >
              <Text style={styles.chipText} numberOfLines={1}>{`${chip.label} ×`}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {filterCount ? (
        <Text style={styles.meta} testID="criteria-summary">
          {criteriaSummary(search.search, search.filters)}
        </Text>
      ) : null}
      {filterCount && state.status !== 'error' ? (
        <Button label="Clear all" variant="outline" size="lg" block onPress={search.clearAll} testID="clear-all" />
      ) : null}

      {state.status === 'loading' ? (
        <View style={styles.list} testID="tasks-loading" accessibilityLabel={LOADING_TASKS}>
          <Note live>{LOADING_TASKS}</Note>
          {[0, 1].map((i) => (
            <Skeleton key={i} width="100%" height={56} borderRadius={radius.lg} />
          ))}
        </View>
      ) : state.status === 'error' ? (
        <View style={styles.list}>
          <View style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="assertive" testID="tasks-error">
            <Text style={styles.errorText}>{state.message}</Text>
          </View>
          <Button label="Try again" size="lg" block onPress={search.retry} testID="tasks-retry" />
          {filtered ? <Button label="Clear all" variant="outline" size="lg" block onPress={search.clearAll} testID="clear-all" /> : null}
        </View>
      ) : (
        <View style={styles.list}>
          {search.notice && !filtered ? <SuccessBanner>{search.notice}</SuccessBanner> : null}
          {state.stale ? (
            <View style={styles.error} accessibilityRole="alert" testID="tasks-stale">
              <Text style={styles.errorText}>{REFRESH_FAILED}</Text>
            </View>
          ) : null}
          {state.tasks.length === 0 ? (
            filtered ? (
              <>
                <Note testID="tasks-no-match">{NO_MATCHES}</Note>
                <Button label="Adjust filters" variant="outline" size="lg" block onPress={openFilters} testID="adjust-filters" />
              </>
            ) : (
              <Note testID="tasks-empty">{NO_TASKS}</Note>
            )
          ) : (
            <>
              <Note testID="tasks-count" live>
                {resultCountLabel(state.tasks.length, filtered)}
              </Note>
              {state.tasks.map((task) => (
                <Pressable
                  key={task.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${task.title}, ${taskLine(task)}`}
                  accessibilityHint="Opens the task."
                  onPress={() => openTask(task)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  testID={`task-row-${task.id}`}
                >
                  <Text style={styles.rowTitle}>{task.title}</Text>
                  <Text style={styles.rowText}>{taskLine(task)}</Text>
                </Pressable>
              ))}
            </>
          )}
        </View>
      )}
    </TaskScreen>
  );
}

function Note({ children, testID, live }: { children: string; testID?: string; live?: boolean }) {
  return (
    <View style={styles.note} accessibilityLiveRegion={live ? 'polite' : undefined} testID={testID}>
      <Text style={styles.noteText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 14, lineHeight: 20, color: colors.mutedForeground, marginTop: -8 },
  field: { gap: 8 },
  search: { fontSize: 16, color: colors.foreground, paddingVertical: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 32,
    maxWidth: '100%',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.muted,
  },
  chipText: { fontSize: 13, lineHeight: 18, color: colors.foreground },
  meta: { fontSize: 12, lineHeight: 16, color: colors.mutedForeground },
  list: { gap: 10 },
  note: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.muted },
  noteText: { fontSize: 14, lineHeight: 20, color: colors.foreground },
  error: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.destructiveBorder,
    backgroundColor: colors.alertBackground,
  },
  errorText: { fontSize: 14, lineHeight: 20, color: colors.destructive },
  row: {
    minHeight: touchTarget,
    padding: 12,
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
  },
  pressed: { backgroundColor: colors.muted },
  rowTitle: { fontSize: 15, lineHeight: 22, fontWeight: '700', color: colors.foreground },
  rowText: { fontSize: 12, lineHeight: 18, color: colors.mutedForeground },
});
