import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { controlStyles } from '../../../components/form/fields';
import { TaskScreen } from '../../../components/task/TaskScreen';
import { Button, Skeleton } from '../../../components/ui';
import {
  BACKLOG_PRIORITIES,
  BACKLOG_STATUSES,
  LOAD_FAILED_TITLE,
  STATUS_LABELS,
  countLabel,
  estimateLabel,
  isFiltered,
  priorityLabel,
  type BacklogItem,
} from '../../../domain/backlog';
import { PRIORITY_LABELS } from '../../../domain/models';
import { AccessDenied, AccessProblem, CheckingAccess } from '../../../components/access/AccessScreens';
import { useBoardRepository } from '../../../data/BoardRepositoryContext';
import { useAccessCheckedLoad } from '../../../hooks/useAccessCheckedLoad';
import { useBacklog } from '../../../hooks/useBacklog';
import { colors, radius, touchTarget } from '../../../theme/tokens';

/**
 * US-23: every task of the project's boards in one list, in the backend's order.
 *
 * US-5: the backend confirms membership first, and gives the project's name. A name carried by
 * the link is never shown: until the backend answers there is only “Checking access”.
 */
export default function ProjectBacklogScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const repository = useBoardRepository();
  const load = useCallback(() => repository.getProject(projectId ?? ''), [repository, projectId]);
  const access = useAccessCheckedLoad(projectId, load);
  const { state } = access;

  if (state.status === 'checking') return <CheckingAccess />;
  if (state.status === 'denied') return <AccessDenied denial={state.denial} />;
  if (state.status === 'unverified') return <AccessProblem error={state.error} onRetry={access.retry} />;
  return (
    <BacklogView
      projectId={state.data.id}
      projectName={state.data.name}
      refreshing={state.refreshing}
      onRefresh={access.refresh}
    />
  );
}

function BacklogView({
  projectId,
  projectName,
  refreshing,
  onRefresh,
}: {
  projectId: string;
  /** From the backend, once it has confirmed membership. */
  projectName: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const backlog = useBacklog(projectId);
  const { state, query } = backlog;
  const filtered = isFiltered(query);

  const backToProject = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/projects/[projectId]', params: { projectId } });
  };

  // A refusal: nothing of the project stays on screen, not even the name the link carried.
  if (state.status === 'error' && state.denied) return <AccessDenied denial={state.revoked ? 'revoked' : 'unavailable'} />;
  const openTask = (item: BacklogItem) =>
    router.push({ pathname: '/tasks/[taskId]', params: { taskId: item.id, boardId: item.boardId } });

  const filtersActive = query.statuses.length > 0 || query.priorities.length > 0;

  return (
    <TaskScreen
      title="Project backlog"
      breadcrumb={projectName}
      refreshing={refreshing}
      onRefresh={() => {
        // The membership and the list are both read again; the list stays until the answer.
        onRefresh();
        backlog.refresh();
      }}
      testID="backlog-screen"
    >
      <Text style={styles.subtitle}>Upcoming work, in one ordered list.</Text>

      <TextInput
        value={backlog.searchText}
        onChangeText={backlog.setSearchText}
        placeholder="Search by title"
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        accessibilityLabel="Search the backlog by title"
        style={[controlStyles.control, styles.search]}
        testID="backlog-search"
      />

      <View style={styles.filters}>
        <ChipRow label="Status">
          {BACKLOG_STATUSES.map((status) => (
            <Chip
              key={status}
              label={STATUS_LABELS[status]}
              selected={query.statuses.includes(status)}
              onPress={() => backlog.toggleStatus(status)}
              testID={`status-${status}`}
            />
          ))}
        </ChipRow>
        <ChipRow label="Priority">
          {BACKLOG_PRIORITIES.map((priority) => (
            <Chip
              key={priority}
              label={PRIORITY_LABELS[priority]}
              selected={query.priorities.includes(priority)}
              onPress={() => backlog.togglePriority(priority)}
              testID={`priority-${priority}`}
            />
          ))}
        </ChipRow>
        {filtersActive ? (
          <Pressable accessibilityRole="button" onPress={backlog.clearFilters} hitSlop={12} testID="clear-filters">
            <Text style={styles.link}>Clear filters</Text>
          </Pressable>
        ) : null}
      </View>

      {state.status === 'loading' ? (
        <View style={styles.list} testID="backlog-loading" accessibilityLabel="Loading backlog">
          <Text style={styles.meta} accessibilityLiveRegion="polite">
            Loading backlog…
          </Text>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width="100%" height={76} borderRadius={radius.lg} />
          ))}
        </View>
      ) : state.status === 'error' ? (
        <View style={styles.list}>
          <View style={styles.errorBox} accessibilityRole="alert" testID="backlog-error">
            <Text style={styles.errorTitle}>{LOAD_FAILED_TITLE}</Text>
            <Text style={styles.errorText}>{state.message}</Text>
          </View>
          <Button label="Try again" size="lg" block onPress={backlog.retry} testID="backlog-retry" />
        </View>
      ) : state.items.length === 0 ? (
        <View style={styles.empty} testID="backlog-empty">
          {filtered ? (
            <>
              <Text style={styles.emptyTitle}>No matching backlog items</Text>
              <Text style={styles.emptyText}>Try another title, or clear the search and filters.</Text>
              <Button label="Clear search and filters" size="lg" block onPress={backlog.clearAll} testID="clear-all" />
            </>
          ) : (
            <>
              <Text style={styles.emptyTitle}>No backlog items yet</Text>
              <Text style={styles.emptyText}>Tasks added to this project’s backlog will appear here.</Text>
              <Button label="Back to project" size="lg" block onPress={backToProject} testID="back-to-project" />
            </>
          )}
        </View>
      ) : (
        <View style={styles.list}>
          <Text style={styles.meta} testID="backlog-count">
            {countLabel(state.totalCount)}
          </Text>
          {state.items.map((item, index) => (
            <BacklogRow key={item.id} item={item} position={index + 1} onPress={() => openTask(item)} />
          ))}
          {state.moreError ? (
            <Text style={styles.moreError} accessibilityRole="alert" testID="load-more-error">
              {state.moreError}
            </Text>
          ) : null}
          {state.hasNextPage ? (
            <Button
              label={state.loadingMore ? 'Loading more…' : state.moreError ? 'Try again' : 'Load more'}
              variant="outline"
              size="lg"
              block
              loading={state.loadingMore}
              onPress={backlog.loadMore}
              testID="load-more"
            />
          ) : state.items.length < state.totalCount ? null : (
            <Text style={styles.meta} testID="backlog-end">
              End of the backlog.
            </Text>
          )}
        </View>
      )}
    </TaskScreen>
  );
}

/** “1 · TES-31”, the title, “To do · High” and the estimate, as in the design. */
function BacklogRow({ item, position, onPress }: { item: BacklogItem; position: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${position}, ${item.readableId}, ${item.title}, ${item.columnName}, ${priorityLabel(item.priority)}, ${estimateLabel(item.storyPoints)}`}
      accessibilityHint="Opens the task."
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      testID={`backlog-item-${item.id}`}
    >
      <Text style={styles.rowKey}>
        {position} · {item.readableId}
      </Text>
      <Text style={styles.rowTitle}>{item.title}</Text>
      <Text style={styles.rowText}>
        {item.columnName} · {priorityLabel(item.priority)}
      </Text>
      <Text style={styles.rowText}>{estimateLabel(item.storyPoints)}</Text>
    </Pressable>
  );
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.chipRow}>
      <Text style={styles.chipLabel}>{label}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

function Chip({ label, selected, onPress, testID }: { label: string; selected: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={[styles.chip, selected && styles.chipSelected]}
      testID={testID}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 15, lineHeight: 22, color: colors.mutedForeground },
  search: { fontSize: 16, color: colors.foreground, paddingVertical: 10 },
  filters: { gap: 10 },
  chipRow: { gap: 6 },
  chipLabel: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.mutedForeground },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, lineHeight: 18, color: colors.foreground },
  chipTextSelected: { color: colors.primaryForeground, fontWeight: '500' },
  link: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.foreground, textDecorationLine: 'underline' },
  list: { gap: 10 },
  meta: { fontSize: 12, lineHeight: 16, color: colors.mutedForeground },
  row: {
    minHeight: touchTarget,
    padding: 12,
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
  },
  rowPressed: { backgroundColor: colors.muted },
  rowKey: { fontSize: 11, lineHeight: 16, color: colors.mutedForeground },
  rowTitle: { fontSize: 15, lineHeight: 22, fontWeight: '700', color: colors.foreground },
  rowText: { fontSize: 12, lineHeight: 18, color: colors.mutedForeground },
  errorBox: {
    padding: 12,
    gap: 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.destructiveBorder,
    backgroundColor: colors.alertBackground,
  },
  errorTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.destructive },
  errorText: { fontSize: 13, lineHeight: 18, color: colors.destructive },
  moreError: { fontSize: 13, lineHeight: 18, color: colors.destructive },
  empty: { gap: 12, marginTop: 16 },
  emptyTitle: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.foreground },
  emptyText: { fontSize: 15, lineHeight: 22, color: colors.foreground, marginBottom: 12 },
});
