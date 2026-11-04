import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BoardState } from '../../components/board/BoardState';
import { BoardLoadError } from '../../data/BoardRepository';
import { useBoardRepository } from '../../data/BoardRepositoryContext';
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

  if (state.boards.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.detail}>You aren’t a member of any project with a board.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.list}>
      {state.boards.map((board) => (
        <Pressable
          key={board.id}
          accessibilityRole="button"
          accessibilityLabel={board.name}
          onPress={() => router.push({ pathname: '/boards/[boardId]', params: { boardId: board.id } })}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.muted }]}
        >
          <Text style={styles.name}>{board.name}</Text>
          <Text style={styles.detail}>{board.projectName}</Text>
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
