import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../auth/AuthContext';
import { AuthScreen, ErrorText, ScreenTitle } from '../components/auth/AuthForm';
import { BoardState } from '../components/board/BoardState';
import { Button } from '../components/ui';
import { BoardLoadError } from '../data/BoardRepository';
import { useBoardRepository } from '../data/BoardRepositoryContext';
import { LOGOUT_FAILED } from '../domain/authErrors';
import type { ProjectSummary } from '../domain/models';
import { colors, radius } from '../theme/tokens';

type ProjectsState =
  | { status: 'loading' }
  | { status: 'ready'; projects: ProjectSummary[] }
  | { status: 'error'; message: string };

type LogoutState = 'idle' | 'loggingOut' | 'failed';

/** The signed-in landing screen: the user's projects, and logging out. */
export default function ProjectsScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const repository = useBoardRepository();
  const [state, setState] = useState<ProjectsState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [logoutState, setLogoutState] = useState<LogoutState>('idle');

  useEffect(() => {
    let active = true;
    repository.listProjects().then(
      (projects) => active && setState({ status: 'ready', projects }),
      (error: unknown) =>
        active &&
        setState({
          status: 'error',
          message: error instanceof BoardLoadError ? error.message : 'Something went wrong while loading your projects.',
        }),
    );
    return () => {
      active = false;
    };
  }, [repository, reloadKey]);

  const onLogout = async () => {
    if (logoutState === 'loggingOut') return;
    setLogoutState('loggingOut');
    try {
      // On success the root layout's guard replaces this screen, so there is nothing to reset.
      await logout();
    } catch {
      setLogoutState('failed');
    }
  };

  const loggingOut = logoutState === 'loggingOut';

  return (
    <AuthScreen testID="projects-screen">
      <ScreenTitle title="Your projects" subtitle="Pick up where your team left off." />

      <View style={styles.logout}>
        <Button
          label={loggingOut ? 'Logging out…' : 'Log out'}
          variant="outline"
          size="lg"
          block
          loading={loggingOut}
          onPress={() => void onLogout()}
          testID="logout-button"
        />
        {loggingOut ? <Text style={styles.hint}>Ending your session…</Text> : null}
        {logoutState === 'failed' ? (
          <>
            <ErrorText testID="logout-error">{LOGOUT_FAILED}</ErrorText>
            <Button label="Try again" size="lg" block onPress={() => void onLogout()} testID="logout-retry" />
          </>
        ) : null}
      </View>

      {state.status === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator accessibilityLabel="Loading projects" />
        </View>
      ) : null}

      {state.status === 'error' ? (
        <View style={styles.center}>
          <BoardState
            type="error"
            title="Couldn’t load your projects"
            description={state.message}
            onAction={() => {
              setState({ status: 'loading' });
              setReloadKey((k) => k + 1);
            }}
          />
        </View>
      ) : null}

      {state.status === 'ready' && state.projects.length === 0 ? (
        <Text style={[styles.hint, styles.empty]}>You aren’t a member of any project yet.</Text>
      ) : null}

      {state.status === 'ready'
        ? state.projects.map((project) => (
            <View key={project.id} style={styles.card} testID={`project-${project.id}`}>
              <Text style={styles.cardTitle}>{project.name}</Text>
              {project.description ? <Text style={styles.cardText}>{project.description}</Text> : null}
              <Button
                label="Open project"
                size="lg"
                block
                accessibilityLabel={`Open ${project.name}`}
                onPress={() => router.push({ pathname: '/boards', params: { projectId: project.id } })}
                style={styles.cardButton}
              />
            </View>
          ))
        : null}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  logout: { marginTop: 24, gap: 12 },
  hint: { fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
  empty: { marginTop: 24 },
  center: { alignItems: 'center', paddingVertical: 32 },
  card: {
    marginTop: 20,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    gap: 4,
  },
  cardTitle: { fontSize: 18, lineHeight: 28, fontWeight: '600', color: colors.foreground },
  cardText: { fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
  cardButton: { marginTop: 8 },
});
