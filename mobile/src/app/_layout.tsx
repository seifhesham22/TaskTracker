import { Stack, useGlobalSearchParams, usePathname, useRouter, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthProvider, useAuth } from '../auth/AuthContext';
import { safeReturnPath } from '../domain/access';
import { colors } from '../theme/tokens';

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}

/**
 * Projects and boards exist only for a signed-in user; login and registration only for a
 * signed-out one. When the session starts or ends, Expo Router leaves the screens that are no
 * longer allowed and shows the first allowed one: the projects after login, the login screen
 * after logout or when the session expires.
 */
function RootNavigator() {
  const { status } = useAuth();
  useReturnAfterExpiry();

  if (status === 'restoring') {
    return (
      <View style={styles.splash}>
        <ActivityIndicator accessibilityLabel="Restoring your session" />
      </View>
    );
  }

  const signedIn = status === 'signedIn';
  return (
    <Stack>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="index" options={{ headerShown: false, title: 'Your projects' }} />
        <Stack.Screen name="boards/index" options={{ title: 'Boards' }} />
        <Stack.Screen name="boards/[boardId]" options={{ headerShown: false }} />
        <Stack.Screen name="tasks/[taskId]/index" options={{ headerShown: false, title: 'Task details' }} />
        <Stack.Screen name="tasks/[taskId]/edit" options={{ headerShown: false, title: 'Edit task' }} />
        <Stack.Screen name="tasks/[taskId]/subtask" options={{ headerShown: false, title: 'Create subtask' }} />
        <Stack.Screen name="tasks/[taskId]/dependencies" options={{ headerShown: false, title: 'Task dependencies' }} />
        <Stack.Screen name="projects/new" options={{ headerShown: false, title: 'Create a project' }} />
        <Stack.Screen name="projects/[projectId]/index" options={{ headerShown: false, title: 'Project boards' }} />
        <Stack.Screen name="projects/[projectId]/boards/new" options={{ headerShown: false, title: 'Create a board' }} />
        <Stack.Screen name="projects/[projectId]/members/index" options={{ headerShown: false, title: 'Project members' }} />
        <Stack.Screen name="projects/[projectId]/members/add" options={{ headerShown: false, title: 'Add a member' }} />
        <Stack.Screen name="projects/[projectId]/members/remove" options={{ headerShown: false, title: 'Remove member' }} />
        <Stack.Screen name="projects/[projectId]/backlog" options={{ headerShown: false, title: 'Project backlog' }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false, title: 'Log in' }} />
        <Stack.Screen name="register" options={{ headerShown: false, title: 'Create account' }} />
      </Stack.Protected>
      <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
    </Stack>
  );
}

/**
 * After an expired session, logging in again goes back to the screen the user was on, if it is one
 * of the app's own project, board or task screens. That screen then reads its data from the
 * backend, which checks membership again: if access was lost meanwhile, it shows No access.
 */
function useReturnAfterExpiry() {
  const { status, notice } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { boardId } = useGlobalSearchParams<{ boardId?: string }>();
  /** Where the user is, while signed in (or opening a link while the session is restored). */
  const lastPath = useRef<string | null>(null);
  const returnTo = useRef<string | null>(null);
  /** Set by a login after expiry, until the guard has left the login screen. */
  const pending = useRef<string | null>(null);
  const previous = useRef(status);

  useEffect(() => {
    if (status === 'signedOut') return;
    // A task screen's board is a query parameter; elsewhere `boardId` is part of the path already.
    const onTask = pathname.startsWith('/tasks/') && typeof boardId === 'string';
    lastPath.current = onTask ? `${pathname}?boardId=${boardId}` : pathname;
  }, [status, pathname, boardId]);

  useEffect(() => {
    const was = previous.current;
    previous.current = status;
    if (status === 'signedOut' && was !== 'signedOut') {
      // Only for an expired session: after a logout the next user starts from their projects.
      returnTo.current = notice === 'expired' ? safeReturnPath(lastPath.current) : null;
    } else if (status === 'signedIn' && was === 'signedOut' && returnTo.current) {
      pending.current = returnTo.current;
      returnTo.current = null;
    }
  }, [status, notice]);

  // Once the guard has left the login screen for the projects, go on to where the user was.
  useEffect(() => {
    if (status !== 'signedIn' || !pending.current || pathname === '/login' || pathname === '/register') return;
    const path = pending.current;
    pending.current = null;
    router.push(path as Href);
  }, [status, pathname, router]);
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
