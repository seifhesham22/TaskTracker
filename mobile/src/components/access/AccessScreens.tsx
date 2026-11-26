import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  ACCESS_CHANGED,
  CHECKING_ACCESS,
  CONTACT_OWNER,
  COULD_NOT_CONNECT,
  PROJECT_UNAVAILABLE,
  SERVER_PROBLEM,
  accessProblemOf,
  type AccessDenial,
} from '../../domain/access';
import { colors, radius } from '../../theme/tokens';
import { ErrorBanner, TaskScreen } from '../task/TaskScreen';
import { Button } from '../ui';

/**
 * Leaves every project screen for the project list, which reads the user's projects again: a
 * project they lost access to is gone from it, the others are still there.
 */
export function useBackToProjects() {
  const router = useRouter();
  return useCallback(() => router.dismissTo('/'), [router]);
}

/**
 * The neutral loading shell: nothing of the project, not even its name, and no action, before the
 * backend answers.
 */
export function CheckingAccess() {
  return (
    <TaskScreen title={CHECKING_ACCESS.title} testID="access-checking">
      <Text style={styles.subtitle}>{CHECKING_ACCESS.subtitle}</Text>
      <View
        style={styles.status}
        accessibilityRole="progressbar"
        accessibilityLabel={CHECKING_ACCESS.status}
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.statusText}>{CHECKING_ACCESS.status}</Text>
      </View>
      <Text style={styles.subtitle}>{CHECKING_ACCESS.note}</Text>
    </TaskScreen>
  );
}

/** Project unavailable, or Your project access has changed. Generic: no project name or data. */
export function AccessDenied({ denial }: { denial: AccessDenial }) {
  const back = useBackToProjects();
  const copy = denial === 'revoked' ? ACCESS_CHANGED : PROJECT_UNAVAILABLE;
  return (
    <TaskScreen title={copy.title} testID={`access-${denial}`}>
      <Text style={styles.subtitle} accessibilityRole="alert" accessibilityLiveRegion="polite">
        {copy.subtitle}
      </Text>
      <Text style={styles.body}>{CONTACT_OWNER}</Text>
      <Button label="Back to projects" size="lg" block style={styles.button} onPress={back} testID="back-to-projects" />
    </TaskScreen>
  );
}

/**
 * Access couldn't be checked. Never shown as a refusal: the design's Couldn't connect for a lost
 * connection, the same layout with the server's or the app's own explanation otherwise.
 */
export function AccessUnverified({
  onRetry,
  cause = 'network',
  detail,
}: {
  onRetry: () => void;
  cause?: 'network' | 'server' | 'configuration';
  /** The configuration problem, in the app's words. */
  detail?: string;
}) {
  const back = useBackToProjects();
  const copy = cause === 'network' ? COULD_NOT_CONNECT : SERVER_PROBLEM;
  const message = cause === 'configuration' && detail ? detail : copy.error;
  return (
    <TaskScreen title={copy.title} testID={cause === 'network' ? 'access-unverified' : 'access-service-problem'}>
      <Text style={styles.subtitle}>{copy.subtitle}</Text>
      <ErrorBanner>{message}</ErrorBanner>
      <View style={styles.actions}>
        <Button label="Try again" size="lg" block style={styles.button} onPress={onRetry} testID="access-retry" />
        <Button
          label="Back to projects"
          variant="outline"
          size="lg"
          block
          style={styles.button}
          onPress={back}
          testID="back-to-projects"
        />
      </View>
    </TaskScreen>
  );
}

/**
 * The screen for a failure to read project data, from its structured error: a refusal (generic),
 * an expired session (nothing, while the app signs out), or a problem that isn't a refusal.
 * `revoked`: the data was on screen before.
 */
export function AccessProblem({ error, revoked, onRetry }: { error: unknown; revoked?: boolean; onRetry: () => void }) {
  const problem = accessProblemOf(error);
  if (problem === 'denied') return <AccessDenied denial={revoked ? 'revoked' : 'unavailable'} />;
  if (problem === 'expired') return <CheckingAccess />;
  const detail = error instanceof Error ? error.message : undefined;
  return <AccessUnverified onRetry={onRetry} cause={problem} detail={detail} />;
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
  body: { fontSize: 16, lineHeight: 24, color: colors.foreground },
  status: {
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
  },
  statusText: { fontSize: 14, lineHeight: 20, color: colors.foreground },
  actions: { gap: 12 },
  button: { height: 48 },
});
