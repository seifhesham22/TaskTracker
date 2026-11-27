import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BacklogRows } from '../../../components/backlog/BacklogRows';
import {
  InfoBox,
  ItemActionsPanel,
  MoveToPositionPanel,
  PrioritySheet,
} from '../../../components/backlog/BacklogManagement';
import { controlStyles } from '../../../components/form/fields';
import { SuccessBanner, TaskScreen } from '../../../components/task/TaskScreen';
import { Button, Skeleton } from '../../../components/ui';
import {
  BACKLOG_PRIORITIES,
  BACKLOG_STATUSES,
  LOAD_FAILED_TITLE,
  READ_ONLY_NOTE,
  REORDER_PAUSED,
  SAVING_ORDER,
  STATUS_LABELS,
  canManageBacklog,
  countLabel,
  isFiltered,
  roleViewLabel,
  type BacklogItem,
} from '../../../domain/backlog';
import { PRIORITY_LABELS } from '../../../domain/models';
import { AccessDenied, AccessProblem, CheckingAccess } from '../../../components/access/AccessScreens';
import { useBoardRepository } from '../../../data/BoardRepositoryContext';
import { useAccessCheckedLoad } from '../../../hooks/useAccessCheckedLoad';
import { useBacklog } from '../../../hooks/useBacklog';
import { colors, radius } from '../../../theme/tokens';

/**
 * US-23: every task of the project's boards in one list, in the backend's order.
 *
 * US-5: the backend confirms membership first, and gives the project's name. A name carried by
 * the link is never shown: until the backend answers there is only “Checking access”.
 *
 * US-24: writers and the owner change an item's priority and its place in the backlog.
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
      role={state.data.role}
      refreshing={state.refreshing}
      onRefresh={access.refresh}
    />
  );
}

type Mode = 'list' | 'actions' | 'position';

function BacklogView({
  projectId,
  projectName,
  role,
  refreshing,
  onRefresh,
}: {
  projectId: string;
  /** From the backend, once it has confirmed membership. */
  projectName: string;
  /** The user's role in the project, from the backend: it decides who may change the backlog. */
  role: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const router = useRouter();
  // A refusal by role reads the membership again, so the controls follow the user's new role.
  const backlog = useBacklog(projectId, { onRoleRefused: onRefresh });
  const { state, query, pending, notice } = backlog;
  const filtered = isFiltered(query);

  // US-24: writers and the owner manage the backlog; the backend checks it again on every change.
  const canManage = canManageBacklog(role);
  // Rows are numbered like the backlog itself only on the unfiltered list, loaded from page 1.
  const canReorder = canManage && !filtered;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('list');
  const [priorityFor, setPriorityFor] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const items = state.status === 'ready' ? state.items : [];
  const totalCount = state.status === 'ready' ? state.totalCount : 0;
  // A selection lasts only while its item is shown and the user may still manage the backlog.
  const selected = canManage ? (items.find((i) => i.id === selectedId) ?? null) : null;
  const view: Mode = selected ? mode : 'list';
  const positionOf = (item: BacklogItem) => (filtered ? null : items.indexOf(item) + 1);
  const priorityItem = canManage ? (items.find((i) => i.id === priorityFor) ?? null) : null;

  const move = (item: BacklogItem, target: number) => {
    setSelectedId(item.id);
    setMode('list');
    backlog.reorder(item.id, target);
  };

  const backToProject = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/projects/[projectId]', params: { projectId } });
  };

  // A refusal: nothing of the project stays on screen, not even the name the link carried.
  if (state.status === 'error' && state.denied) return <AccessDenied denial={state.revoked ? 'revoked' : 'unavailable'} />;
  const openTask = (item: BacklogItem) =>
    router.push({ pathname: '/tasks/[taskId]', params: { taskId: item.id, boardId: item.boardId } });

  const filtersActive = query.statuses.length > 0 || query.priorities.length > 0;
  const viewLabel = roleViewLabel(role);
  const roleLine = viewLabel ? (
    <Text style={styles.meta} testID="backlog-role-view">
      {`${projectName} · ${viewLabel}`}
    </Text>
  ) : null;

  // Item actions and Move to position, as the design's own steps, for the selected item.
  if (view !== 'list' && selected) {
    const position = positionOf(selected);
    return (
      <TaskScreen title="Project backlog" breadcrumb={projectName} avoidKeyboardOnAndroid testID="backlog-screen">
        {roleLine}
        {view === 'position' && position ? (
          <MoveToPositionPanel
            item={selected}
            position={position}
            totalCount={totalCount}
            itemAt={(place) => items[place - 1]}
            onMove={(target) => move(selected, target)}
            onCancel={() => setMode('actions')}
          />
        ) : (
          <ItemActionsPanel
            item={selected}
            position={position}
            totalCount={totalCount}
            canReorder={canReorder}
            onMoveUp={() => {
              if (position) move(selected, position - 1);
            }}
            onMoveDown={() => {
              if (position) move(selected, position + 1);
            }}
            onMoveToPosition={() => setMode('position')}
            onChangePriority={() => {
              setMode('list');
              setPriorityFor(selected.id);
            }}
            onCancel={() => setMode('list')}
          />
        )}
      </TaskScreen>
    );
  }

  return (
    <TaskScreen
      title="Project backlog"
      breadcrumb={projectName}
      refreshing={refreshing}
      onRefresh={
        pending
          ? undefined
          : () => {
              // The membership and the list are both read again; the list stays until the answer.
              onRefresh();
              backlog.refresh();
            }
      }
      scrollEnabled={!dragging}
      testID="backlog-screen"
    >
      <Text style={styles.subtitle}>Upcoming work, in one ordered list.</Text>
      {roleLine}

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
        editable={pending !== 'order'}
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
              disabled={pending === 'order'}
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
              disabled={pending === 'order'}
              onPress={() => backlog.togglePriority(priority)}
              testID={`priority-${priority}`}
            />
          ))}
        </ChipRow>
        {filtersActive ? (
          <Pressable
            accessibilityRole="button"
            disabled={pending === 'order'}
            onPress={backlog.clearFilters}
            hitSlop={12}
            testID="clear-filters"
          >
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
          {pending === 'order' ? (
            <View accessibilityLiveRegion="polite" testID="saving-order">
              <InfoBox>{SAVING_ORDER}</InfoBox>
            </View>
          ) : notice?.tone === 'success' ? (
            <SuccessBanner>{notice.text}</SuccessBanner>
          ) : notice?.tone === 'error' ? (
            <View style={styles.errorBox} accessibilityRole="alert" accessibilityLiveRegion="assertive" testID="backlog-save-error">
              <Text style={styles.errorText}>{notice.text}</Text>
              {notice.detail ? <Text style={styles.errorText}>{notice.detail}</Text> : null}
            </View>
          ) : null}
          {canManage && filtered ? <InfoBox testID="reorder-paused">{REORDER_PAUSED}</InfoBox> : null}
          {!filtered && state.items.length < state.totalCount ? (
            <InfoBox testID="backlog-range">
              {`Showing 1–${state.items.length} of ${state.totalCount} items. Positions are global.${
                canReorder ? ' Hold a handle and drag within the loaded items, or use Move to position… for any place.' : ''
              }`}
            </InfoBox>
          ) : null}
          <BacklogRows
            items={state.items}
            totalCount={state.totalCount}
            canSelect={canManage}
            canDrag={canReorder}
            disabled={pending !== null}
            selectedId={selected?.id ?? null}
            onOpen={openTask}
            onSelect={(item) => setSelectedId(item.id)}
            onMove={move}
            onDragChange={setDragging}
          />
          {canManage ? (
            <>
              <Button
                label={pending === 'order' ? 'Saving…' : 'Item actions'}
                size="lg"
                block
                disabled={!selected || pending !== null}
                accessibilityLabel={selected ? `Item actions for ${selected.readableId}` : 'Item actions'}
                onPress={() => setMode('actions')}
                testID="item-actions-button"
              />
              {!selected ? (
                <Text style={styles.meta} testID="select-hint">
                  {canReorder
                    ? 'Tap an item’s handle, or long-press the item, to choose it.'
                    : 'Long-press an item to choose it.'}
                </Text>
              ) : null}
              {filtered ? (
                <Button
                  label="Clear search & filters"
                  variant="outline"
                  size="lg"
                  block
                  disabled={pending !== null}
                  onPress={backlog.clearAll}
                  testID="clear-search-filters"
                />
              ) : null}
            </>
          ) : (
            <InfoBox testID="read-only-note">{READ_ONLY_NOTE}</InfoBox>
          )}
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
              disabled={pending !== null}
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
      <PrioritySheet
        item={priorityItem}
        saving={pending === 'priority'}
        onApply={async (priority) => {
          if (!priorityItem) return null;
          const failure = await backlog.changePriority(priorityItem.id, priority);
          if (!failure) setPriorityFor(null);
          return failure;
        }}
        onClose={() => setPriorityFor(null)}
      />
    </TaskScreen>
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

function Chip({
  label,
  selected,
  disabled,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      accessibilityLabel={label}
      disabled={disabled}
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
