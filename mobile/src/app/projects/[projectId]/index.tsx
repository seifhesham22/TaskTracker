import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AccessDenied, AccessProblem, CheckingAccess, useBackToProjects } from '../../../components/access/AccessScreens';
import { TaskScreen } from '../../../components/task/TaskScreen';
import { Button } from '../../../components/ui';
import { useBoardRepository } from '../../../data/BoardRepositoryContext';
import { ONLY_OWNER_CREATES_BOARDS } from '../../../domain/createBoard';
import { ROLE_LABELS } from '../../../domain/members';
import { useAccessCheckedLoad } from '../../../hooks/useAccessCheckedLoad';
import { colors, radius } from '../../../theme/tokens';

/**
 * US-5: a project's boards, shown only once the backend has confirmed the user is a member. Opened
 * from the project list or a direct link; both are checked the same way, every time.
 */
export default function ProjectScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const repository = useBoardRepository();
  const back = useBackToProjects();
  const load = useCallback(() => repository.getProject(projectId ?? ''), [repository, projectId]);
  const { state, retry, refresh } = useAccessCheckedLoad(projectId, load);

  if (state.status === 'checking') return <CheckingAccess />;
  if (state.status === 'denied') return <AccessDenied denial={state.denial} />;
  if (state.status === 'unverified') return <AccessProblem error={state.error} onRetry={retry} />;

  const project = state.data;
  // US-7: the role is the backend's (`projects` → role). The backend refuses others anyway.
  const isOwner = project.role === 'OWNER';
  const roleLabel = project.role ? ROLE_LABELS[project.role] : undefined;
  return (
    <TaskScreen title="Project boards" refreshing={state.refreshing} onRefresh={refresh} testID="project-screen">
      <Text style={styles.subtitle} testID="project-subtitle">
        {[project.name, roleLabel].filter(Boolean).join(' · ')}
      </Text>
      {project.boards.length === 0 ? <Text style={styles.subtitle}>This project has no boards yet.</Text> : null}
      {project.boards.map((board) => (
        <View key={board.id} style={styles.card} testID={`board-${board.id}`}>
          <Text style={styles.name}>{board.name}</Text>
          <Text style={styles.detail}>Board · {project.name}</Text>
          <Button
            label="Open board"
            variant="outline"
            size="lg"
            block
            style={styles.button}
            accessibilityLabel={`Open board ${board.name}`}
            onPress={() => router.push({ pathname: '/boards/[boardId]', params: { boardId: board.id } })}
            testID={`open-board-${board.id}`}
          />
        </View>
      ))}
      {isOwner ? (
        <Button
          label="Create board"
          size="lg"
          block
          style={styles.button}
          onPress={() => router.push({ pathname: '/projects/[projectId]/boards/new', params: { projectId: project.id } })}
          testID="create-board-button"
        />
      ) : (
        <Text style={styles.note} testID="owner-only-note">
          {ONLY_OWNER_CREATES_BOARDS}
        </Text>
      )}
      <Button label="Back to projects" variant="outline" size="lg" block style={styles.button} onPress={back} testID="back-to-projects" />
    </TaskScreen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
  card: {
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
  },
  name: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.foreground },
  detail: { fontSize: 13, lineHeight: 18, color: colors.mutedForeground },
  note: { fontSize: 15, lineHeight: 22, color: colors.foreground },
  button: { height: 48, marginTop: 8 },
});
