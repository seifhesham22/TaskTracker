import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BoardColumnPager, BoardSkeleton } from '../../components/board/BoardColumnPager';
import { BoardColumnTabs, BoardColumnTabsSkeleton } from '../../components/board/BoardColumnTabs';
import { BoardHeader } from '../../components/board/BoardHeader';
import { BoardState } from '../../components/board/BoardState';
import { CreateTaskButton } from '../../components/board/CreateTaskButton';
import { Toast } from '../../components/board/Toast';
import { UnplacedTasksNotice } from '../../components/board/UnplacedTasksNotice';
import { CreateTaskSheet } from '../../components/createTask/CreateTaskSheet';
import { useBoardRepository } from '../../data/BoardRepositoryContext';
import { groupTasksByColumn } from '../../domain/board';
import type { Task } from '../../domain/models';
import { REFRESH_FAILED_MESSAGE, useBoard } from '../../hooks/useBoard';
import { colors } from '../../theme/tokens';

const NO_COLUMNS_TITLE = 'This board has no columns';
const NO_COLUMNS_DESCRIPTION = 'Tasks need a column to go in. Add columns to this board, then try again.';

const taskCount = (n: number) => `${n} ${n === 1 ? 'task' : 'tasks'}`;

export default function BoardScreen() {
  const { boardId } = useLocalSearchParams<{ boardId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const repository = useBoardRepository();
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const hideToast = useCallback(() => setToast(null), []);
  const showRefreshFailure = useCallback(() => setToast({ message: REFRESH_FAILED_MESSAGE, tone: 'error' }), []);
  const { state, showSkeleton, retry, refresh, addCreatedTask, markNotFound } = useBoard(boardId, showRefreshFailure);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [createIn, setCreateIn] = useState<string | null | undefined>(undefined);

  const goToBoards = () => router.replace('/boards');
  const goBack = () => (router.canGoBack() ? router.back() : goToBoards());

  const data = state.status === 'ready' ? state.data : null;
  const columns = useMemo(() => data?.board.columns ?? [], [data]);
  const grouped = useMemo(() => groupTasksByColumn(columns, data?.tasks ?? []), [columns, data]);
  const counts = useMemo(
    () => Object.fromEntries(Object.entries(grouped.byColumn).map(([id, tasks]) => [id, tasks.length])),
    [grouped],
  );
  const current = Math.max(
    columns.findIndex((column) => column.id === activeColumnId),
    0,
  );
  const selectIndex = (index: number) => setActiveColumnId(columns[index]?.id ?? null);
  const openCreate = (columnId?: string) => setCreateIn(columnId ?? columns[current]?.id ?? null);

  const handleCreated = (task: Task) => {
    setCreateIn(undefined);
    setToast({ message: 'Task created', tone: 'success' });
    setActiveColumnId(task.columnId);
    addCreatedTask(task);
  };

  const handleBoardNotFound = (message: string) => {
    setCreateIn(undefined);
    markNotFound(message);
  };

  let content;
  if (state.status === 'loading') {
    content = showSkeleton ? (
      <>
        <BoardHeader onBack={goBack} loading />
        <BoardColumnTabsSkeleton />
        <BoardSkeleton />
      </>
    ) : (
      <BoardHeader onBack={goBack} />
    );
  } else if (state.status === 'error') {
    content = (
      <>
        <BoardHeader onBack={goBack} />
        <View style={styles.center}>
          {state.error.kind === 'notFound' ? (
            <BoardState type="notfound" onAction={goToBoards} />
          ) : (
            <BoardState type="error" onAction={retry} description={state.error.message} />
          )}
        </View>
      </>
    );
  } else {
    const { board, tasks } = state.data;
    content = (
      <>
        <BoardHeader onBack={goBack} title={board.name} subtitle={[board.projectName, taskCount(tasks.length)].filter(Boolean).join(' · ')} />
        {columns.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.scrollCenter}
            refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={refresh} />}
            testID="board-no-columns"
          >
            <BoardState type="error" title={NO_COLUMNS_TITLE} description={NO_COLUMNS_DESCRIPTION} onAction={refresh} />
          </ScrollView>
        ) : (
          <>
            <BoardColumnTabs columns={columns} counts={counts} activeIndex={current} onSelect={selectIndex} />
            {grouped.unplaced.length > 0 ? <UnplacedTasksNotice tasks={grouped.unplaced} /> : null}
            <BoardColumnPager
              columns={columns}
              tasksByColumn={grouped.byColumn}
              members={board.members}
              activeIndex={current}
              onIndexChange={selectIndex}
              onAddTask={openCreate}
              refreshing={state.refreshing}
              onRefresh={refresh}
            />
            {tasks.length > 0 ? <CreateTaskButton onPress={() => openCreate()} /> : null}
          </>
        )}
        {createIn !== undefined ? (
          <CreateTaskSheet
            board={board}
            columnId={createIn ?? undefined}
            createTask={repository.createTask}
            onClose={() => setCreateIn(undefined)}
            onCreated={handleCreated}
            onBoardNotFound={handleBoardNotFound}
          />
        ) : null}
        {toast ? <Toast message={toast.message} tone={toast.tone} onHide={hideToast} /> : null}
      </>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingBottom: 80 },
  scrollCenter: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingBottom: 80 },
});
