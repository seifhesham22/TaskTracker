import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AccessDenied, AccessProblem, CheckingAccess } from '../../components/access/AccessScreens';
import { useBoardRepository } from '../../data/BoardRepositoryContext';
import { onAccessLost } from '../../data/projectAccess';
import { useAccessCheckedLoad } from '../../hooks/useAccessCheckedLoad';
import { colors, radius, touchTarget } from '../../theme/tokens';

export default function BoardsScreen() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  // A project's boards are on its screen, which checks access before showing anything.
  if (projectId) return <Redirect href={{ pathname: '/projects/[projectId]', params: { projectId } }} />;
  return <AllBoards />;
}

/** Every board of the user's projects. */
function AllBoards() {
  const router = useRouter();
  const repository = useBoardRepository();
  // The boards of the user's projects only, as the backend lists them; read again on focus and
  // when the app comes back to the foreground.
  const { state, retry, reload } = useAccessCheckedLoad(undefined, repository.listBoards);
  // A project lost on any screen: its boards leave this list with the next read.
  useEffect(() => onAccessLost(() => reload()), [reload]);

  const header = <Stack.Screen options={{ title: 'Boards' }} />;

  if (state.status === 'checking') return <CheckingAccess />;
  if (state.status === 'denied') return <AccessDenied denial={state.denial} />;
  if (state.status === 'unverified') return <AccessProblem error={state.error} onRetry={retry} />;
  const boards = state.data;

  if (boards.length === 0) {
    return (
      <View style={styles.center}>
        {header}
        <Text style={styles.detail}>
          You aren’t a member of any project with a board.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.list}>
      {header}
      {boards.map((board) => (
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
