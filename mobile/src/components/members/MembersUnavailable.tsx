import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { ProjectMembersState } from '../../hooks/useProjectMembers';
import { BoardState } from '../board/BoardState';

/** What every members screen shows until the members are there. */
export function MembersUnavailable({
  state,
  onRetry,
  onBack,
}: {
  state: Exclude<ProjectMembersState, { status: 'ready' }>;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.center}>
      {state.status === 'loading' ? (
        <ActivityIndicator accessibilityLabel="Loading members" />
      ) : state.notFound ? (
        <BoardState type="notfound" title="Project not found" description={state.message} action="Go back" onAction={onBack} />
      ) : (
        <BoardState type="error" title="Couldn’t load the members" description={state.message} onAction={onRetry} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
});
