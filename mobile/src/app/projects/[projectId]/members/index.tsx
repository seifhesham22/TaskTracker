import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../../../auth/AuthContext';
import { MembersUnavailable } from '../../../../components/members/MembersUnavailable';
import { SuccessBanner, TaskScreen } from '../../../../components/task/TaskScreen';
import { Button } from '../../../../components/ui';
import {
  MEMBERS_REFRESH_FAILED,
  ONLY_OWNER_MANAGES,
  ROLE_LABELS,
  addedNotice,
  canRemove,
  memberRoleLabel,
  removedNotice,
} from '../../../../domain/members';
import { useProjectMembers } from '../../../../hooks/useProjectMembers';
import { colors, radius } from '../../../../theme/tokens';

/** US-4: the project's members; its Owner can add and remove them. */
export default function ProjectMembersScreen() {
  // `notice` is set by the add and remove screens once the backend has confirmed the change.
  const { projectId, notice, name, role } = useLocalSearchParams<{
    projectId: string;
    notice?: 'added' | 'removed';
    name?: string;
    role?: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();
  // The list only shows members: also checked now and then while it is left open.
  const { state, retry, refresh } = useProjectMembers(projectId, { poll: true });

  if (state.status !== 'ready') return <MembersUnavailable state={state} onRetry={retry} />;

  const { project, refreshFailed } = state;
  const isOwner = project.role === 'OWNER';
  const viewLabel = project.role && ROLE_LABELS[project.role] ? ` · ${ROLE_LABELS[project.role]} view` : '';
  const message =
    notice === 'added' && name ? addedNotice(name, role ?? '') : notice === 'removed' && name ? removedNotice(name) : null;
  /** The note about the last change has been seen by the time the user goes on. */
  const leaveTo = (href: Parameters<typeof router.push>[0]) => {
    if (notice) router.setParams({ notice: undefined, name: undefined, role: undefined });
    router.push(href);
  };

  return (
    <TaskScreen title="Project members" refreshing={state.refreshing} onRefresh={refresh} testID="members-screen">
      <Text style={styles.subtitle}>
        {project.projectName}
        {viewLabel}
      </Text>
      {message ? <SuccessBanner>{message}</SuccessBanner> : null}
      {refreshFailed ? (
        <View style={styles.group}>
          <Text style={styles.error} accessibilityRole="alert" testID="members-refresh-error">
            {MEMBERS_REFRESH_FAILED}
          </Text>
          <Button label="Try again" variant="outline" size="lg" block style={styles.button} onPress={retry} testID="members-refresh" />
        </View>
      ) : null}

      {project.members.length === 0 ? <Text style={styles.subtitle}>This project has no members yet.</Text> : null}
      <View style={styles.group}>
        {project.members.map((member) => (
          <View key={member.userId} style={styles.card} testID={`member-${member.userId}`}>
            <Text style={styles.name}>
              {member.userName}
              {member.userId === user?.id ? ' (you)' : ''}
            </Text>
            <Text style={styles.role}>{memberRoleLabel(member, project.members)}</Text>
            {isOwner && canRemove(member) ? (
              <Button
                label="Remove member"
                variant="outline"
                size="lg"
                block
                style={styles.button}
                accessibilityLabel={`Remove ${member.userName}`}
                onPress={() =>
                  leaveTo({
                    pathname: '/projects/[projectId]/members/remove',
                    params: { projectId: project.projectId, userId: member.userId },
                  })
                }
                testID={`remove-${member.userId}`}
              />
            ) : null}
          </View>
        ))}
      </View>

      {isOwner ? (
        <Button
          label="Add member"
          size="lg"
          block
          style={styles.button}
          onPress={() =>
            leaveTo({ pathname: '/projects/[projectId]/members/add', params: { projectId: project.projectId } })
          }
          testID="add-member-button"
        />
      ) : (
        <Text style={styles.subtitle} testID="owner-only-note">
          {ONLY_OWNER_MANAGES}
        </Text>
      )}
    </TaskScreen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 15, lineHeight: 22, color: colors.mutedForeground },
  group: { gap: 12 },
  card: {
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
  },
  name: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.foreground },
  role: { fontSize: 13, lineHeight: 18, color: colors.mutedForeground },
  error: { fontSize: 14, lineHeight: 20, color: colors.destructive },
  button: { height: 48 },
});
