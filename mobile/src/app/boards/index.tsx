import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DemoBanner } from '../../components/board/BoardHeader';
import { BoardState } from '../../components/board/BoardState';
import { BoardLoadError } from '../../data/BoardRepository';
import { useBoardRepository } from '../../data/BoardRepositoryContext';
import { DEMO_MISSING_BOARD_ID } from '../../data/demoBoardRepository';
import type { BoardSummary } from '../../domain/models';
import { colors, radius, touchTarget } from '../../theme/tokens';

type ListState = { status: 'loading' } | { status: 'ready'; boards: BoardSummary[] } | { status: 'error'; message: string };

export default function BoardsScreen() {
  const router = useRouter();
  const repository = useBoardRepository();
  const [state, setState] = useState<ListState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    repository.listBoards().then(
      (boards) => active && setState({ status: 'ready', boards }),
      (error: unknown) =>
        active &&
        setState({ status: 'error', message: error instanceof BoardLoadError ? error.message : 'Something went wrong.' }),
    );
    return () => {
      active = false;
    };
  }, [repository, reloadKey]);

  if (state.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator accessibilityLabel="Loading boards" />
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.center}>
        <BoardState
          type="error"
          title="Couldn’t load your boards"
          description={state.message}
          onAction={() => {
            setState({ status: 'loading' });
            setReloadKey((k) => k + 1);
          }}
        />
      </View>
    );
  }

  const rows: { id: string; name: string; detail: string }[] = state.boards.map((b) => ({
    id: b.id,
    name: b.name,
    detail: b.projectName,
  }));
  if (repository.mode === 'demo') {
    rows.push({ id: DEMO_MISSING_BOARD_ID, name: 'Demo · a board that doesn’t exist', detail: 'Opens “Board not found”' });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.list}>
      {repository.mode === 'demo' ? <DemoBanner /> : null}
      {rows.map((row) => (
        <Pressable
          key={row.id}
          accessibilityRole="button"
          accessibilityLabel={row.name}
          onPress={() => router.push({ pathname: '/boards/[boardId]', params: { boardId: row.id } })}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.muted }]}
        >
          <Text style={styles.name}>{row.name}</Text>
          <Text style={styles.detail}>{row.detail}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: colors.background },
  list: { paddingVertical: 16, gap: 8 },
  row: {
    minHeight: touchTarget + 12,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    justifyContent: 'center',
  },
  name: { fontSize: 16, lineHeight: 24, fontWeight: '500', color: colors.foreground },
  detail: { fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
});
