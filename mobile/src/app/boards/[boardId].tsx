import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BoardColumnPager, BoardSkeleton } from '../../components/board/BoardColumnPager';
import { BoardColumnTabs, BoardColumnTabsSkeleton } from '../../components/board/BoardColumnTabs';
import { BoardHeader, DemoBanner } from '../../components/board/BoardHeader';
import { BoardState } from '../../components/board/BoardState';
import { CreateTaskButton } from '../../components/board/CreateTaskButton';
import { Toast } from '../../components/board/Toast';
import { CreateTaskSheet } from '../../components/createTask/CreateTaskSheet';
import { useBoardRepository } from '../../data/BoardRepositoryContext';
import type { Task } from '../../domain/models';
import { useBoard } from '../../hooks/useBoard';
import { colors } from '../../theme/tokens';

const taskCount = (n: number) => `${n} ${n === 1 ? 'task' : 'tasks'}`;

export default function BoardScreen() {
  const { boardId } = useLocalSearchParams<{ boardId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const repository = useBoardRepository();
  const { state, showSkeleton, retry, refresh, addCreatedTask, markNotFound } = useBoard(boardId);
  const [activeIndex, setActiveIndex] = useState(0);
  // undefined = form closed; null = open, column chosen by the backend (first column).
  const [createIn, setCreateIn] = useState<string | null | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);
  const hideToast = useCallback(() => setToast(null), []);

  const goToBoards = () => router.replace('/boards');
  const goBack = () => (router.canGoBack() ? router.back() : goToBoards());

  const data = state.status === 'ready' ? state.data : null;
  const columns = useMemo(() => data?.board.columns ?? [], [data]);
  const tasksByColumn = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    for (const column of columns) groups[column.id] = [];
    for (const task of data?.tasks ?? []) (groups[task.columnId] ??= []).push(task);
    return groups;
  }, [columns, data]);
  const counts = useMemo(
    () => Object.fromEntries(Object.entries(tasksByColumn).map(([id, tasks]) => [id, tasks.length])),
    [tasksByColumn],
  );
  const current = Math.min(activeIndex, Math.max(columns.length - 1, 0));
  const openCreate = (columnId?: string) => setCreateIn(columnId ?? columns[current]?.id ?? null);

  const handleCreated = (task: Task) => {
    setCreateIn(undefined);
    setToast('Task created');
    const index = columns.findIndex((c) => c.id === task.columnId);
    if (index >= 0) setActiveIndex(index);
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
    const notFound = state.error.kind === 'notFound';
    content = (
      <>
        <BoardHeader onBack={goBack} />
        <View style={styles.center}>
          {notFound ? (
            <BoardState type="notfound" onAction={goToBoards} />
          ) : (
            <BoardState
              type="error"
              onAction={retry}
              description={state.error.kind === 'unsupported' ? state.error.message : undefined}
            />
          )}
        </View>
      </>
    );
  } else {
    const { board, tasks } = state.data;
    content = (
      <>
        <BoardHeader onBack={goBack} title={board.name} subtitle={`${board.projectName} · ${taskCount(tasks.length)}`} />
        {repository.mode === 'demo' ? <DemoBanner /> : null}
        <BoardColumnTabs columns={columns} counts={counts} activeIndex={current} onSelect={setActiveIndex} />
        {tasks.length === 0 ? (
          <View style={styles.center}>
            <BoardState type="empty" onAction={() => openCreate()} />
          </View>
        ) : (
          <>
            <BoardColumnPager
              columns={columns}
              tasksByColumn={tasksByColumn}
              members={board.members}
              activeIndex={current}
              onIndexChange={setActiveIndex}
              onAddTask={openCreate}
              refreshing={state.refreshing}
              onRefresh={refresh}
            />
            <CreateTaskButton onPress={() => openCreate()} />
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
        {toast ? <Toast message={toast} onHide={hideToast} /> : null}
      </>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} aria-busy={state.status === 'loading'}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingBottom: 80 },
});
