import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../auth/AuthContext';
import { AuthScreen, ErrorText, ScreenTitle } from '../components/auth/AuthForm';
import { BoardState } from '../components/board/BoardState';
import { SuccessBanner } from '../components/task/TaskScreen';
import { Button } from '../components/ui';
import { BoardLoadError } from '../data/BoardRepository';
import { useBoardRepository } from '../data/BoardRepositoryContext';
import { LOGOUT_FAILED } from '../domain/authErrors';
import { PROJECT_CREATED, PROJECTS_REFRESH_FAILED, projectAccessLabel } from '../domain/createProject';
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
  const [refreshFailed, setRefreshFailed] = useState(false);
  const latest = useRef(0);
  // Set by the Create a project screen once the backend has saved the project.
  const { created } = useLocalSearchParams<{ created?: string }>();
  const [logoutState, setLogoutState] = useState<LogoutState>('idle');

  const load = useCallback(() => {
    const request = ++latest.current;
    repository.listProjects().then(
      (projects) => {
        if (request !== latest.current) return;
        setRefreshFailed(false);
        setState({ status: 'ready', projects });
      },
      (error: unknown) => {
        if (request !== latest.current) return;
        const message =
          error instanceof BoardLoadError ? error.message : 'Something went wrong while loading your projects.';
        // A failed refresh keeps the projects already shown.
        setRefreshFailed(true);
        setState((current) => (current.status === 'ready' ? current : { status: 'error', message }));
      },
    );
  }, [repository]);

  // Read from the backend each time the list comes into view, so a new project shows at once.
  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        latest.current += 1;
      };
    }, [load]),
  );

  /** Leaves the list; the note about a created project has been seen by then. */
  const leaveTo = (href: Parameters<typeof router.push>[0]) => {
    if (created) router.setParams({ created: undefined });
    router.push(href);
  };

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
      <ScreenTitle title="Your projects" subtitle="Projects you belong to" />

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

      {created ? (
        <View style={styles.notice}>
          <SuccessBanner>{PROJECT_CREATED}</SuccessBanner>
        </View>
      ) : null}
      {state.status === 'ready' && refreshFailed ? (
        <View style={styles.notice}>
          <ErrorText testID="projects-refresh-error">{PROJECTS_REFRESH_FAILED}</ErrorText>
          <Button label="Try again" variant="outline" size="lg" block onPress={load} testID="projects-refresh" />
        </View>
      ) : null}

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
              load();
            }}
          />
        </View>
      ) : null}

      {state.status === 'ready' && state.projects.length === 0 ? (
        <Text style={styles.empty}>No projects yet. Create your first project to get started.</Text>
      ) : null}

      {state.status === 'ready'
        ? state.projects.map((project) => (
            <View key={project.id} style={styles.card} testID={`project-${project.id}`}>
              <Text style={styles.cardTitle}>{project.name}</Text>
              <Text style={styles.cardText}>{projectAccessLabel(project.role)}</Text>
              {project.description ? <Text style={styles.cardText}>{project.description}</Text> : null}
              <Button
                label="Open project"
                variant="outline"
                size="lg"
                block
                accessibilityLabel={`Open ${project.name}`}
                onPress={() => leaveTo({ pathname: '/boards', params: { projectId: project.id } })}
                style={styles.cardButton}
              />
              <Button
                label="View backlog"
                variant="outline"
                size="lg"
                block
                accessibilityLabel={`View the backlog of ${project.name}`}
                onPress={() =>
                  leaveTo({
                    pathname: '/projects/[projectId]/backlog',
                    params: { projectId: project.id, projectName: project.name },
                  })
                }
                testID={`backlog-${project.id}`}
              />
              <Button
                label="Members"
                variant="outline"
                size="lg"
                block
                accessibilityLabel={`Members of ${project.name}`}
                onPress={() =>
                  leaveTo({ pathname: '/projects/[projectId]/members', params: { projectId: project.id } })
                }
                testID={`members-${project.id}`}
              />
            </View>
          ))
        : null}

      {state.status === 'ready' ? (
        <Button
          label="Create project"
          size="lg"
          block
          onPress={() => leaveTo('/projects/new')}
          style={styles.create}
          testID="create-project-button"
        />
      ) : null}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  logout: { marginTop: 24, gap: 12 },
  hint: { fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
  empty: { marginTop: 24, fontSize: 16, lineHeight: 24, color: colors.foreground },
  notice: { marginTop: 20, gap: 12 },
  create: { marginTop: 16, height: 48 },
  center: { alignItems: 'center', paddingVertical: 32 },
  card: {
    marginTop: 16,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 4,
  },
  cardTitle: { fontSize: 18, lineHeight: 28, fontWeight: '600', color: colors.foreground },
  cardText: { fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
  cardButton: { marginTop: 8 },
});
