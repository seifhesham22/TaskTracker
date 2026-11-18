import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthProvider, useAuth } from '../auth/AuthContext';
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
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false, title: 'Log in' }} />
        <Stack.Screen name="register" options={{ headerShown: false, title: 'Create account' }} />
      </Stack.Protected>
      <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
