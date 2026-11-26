import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, type ViewInstance } from 'react-native';

import { MembersUnavailable } from '../../../../components/members/MembersUnavailable';
import { ErrorBanner, TaskScreen } from '../../../../components/task/TaskScreen';
import { Button } from '../../../../components/ui';
import { useBoardRepository } from '../../../../data/BoardRepositoryContext';
import {
  LAST_OWNER,
  ONLY_OWNER_MANAGES,
  canRemove,
  removeFailed,
  removeUnknown,
  toRemoveFailure,
  type ProjectMemberDetails,
  type ProjectMembers,
} from '../../../../domain/members';
import { useBackLock, useProjectMembers } from '../../../../hooks/useProjectMembers';
import { colors } from '../../../../theme/tokens';

/** US-4: the Owner confirms removing a member. Nothing is sent before Remove member is pressed. */
export default function RemoveMemberScreen() {
  const { projectId, userId } = useLocalSearchParams<{
    projectId: string;
    userId: string;
  }>();
  const router = useRouter();
  const { state, retry } = useProjectMembers(projectId);

  const back = () => {
    if (router.canGoBack()) router.back();
    else
      router.replace({
        pathname: '/projects/[projectId]/members',
        params: { projectId },
      });
  };

  if (state.status !== 'ready') return <MembersUnavailable state={state} onRetry={retry} />;

  const { project } = state;
  const member = project.members.find((m) => m.userId === userId);
  if (project.role !== 'OWNER' || !member) {
    return (
      <TaskScreen title="Remove member" testID="remove-member-screen">
        <Text style={styles.subtitle}>{project.projectName}</Text>
        <Text style={styles.text}>
          {project.role !== 'OWNER' ? ONLY_OWNER_MANAGES : 'This account isn’t a member of the project.'}
        </Text>
        <Button label="Back to members" size="lg" block style={styles.button} onPress={back} testID="back-to-members" />
      </TaskScreen>
    );
  }
  if (!canRemove(member)) return <OwnerRequired projectName={project.projectName} onBack={back} />;

  return (
    <RemoveConfirmation
      project={project}
      member={member}
      onBack={back}
      onRemoved={() =>
        // Back to the members, which are read again from the backend.
        router.dismissTo({
          pathname: '/projects/[projectId]/members',
          params: { projectId, notice: 'removed', name: member.userName },
        })
      }
    />
  );
}

/** The backend never leaves a project without its Owner. */
function OwnerRequired({ projectName, onBack }: { projectName: string; onBack: () => void }) {
  return (
    <TaskScreen title="Owner required" testID="owner-required">
      <Text style={styles.subtitle}>{projectName}</Text>
      <ErrorBanner>{LAST_OWNER}</ErrorBanner>
      <Text style={styles.text}>Keep at least one Owner in this project. No membership was changed.</Text>
      <Button label="Back to members" size="lg" block style={styles.button} onPress={onBack} testID="back-to-members" />
    </TaskScreen>
  );
}

type Removal =
  | { status: 'asking' }
  | { status: 'removing' }
  | { status: 'failed'; message: string }
  | { status: 'denied'; message: string }
  | { status: 'owner' };

function RemoveConfirmation({
  project,
  member,
  onBack,
  onRemoved,
}: {
  project: ProjectMembers;
  member: ProjectMemberDetails;
  onBack: () => void;
  onRemoved: () => void;
}) {
  const repository = useBoardRepository();
  const [removal, setRemoval] = useState<Removal>({ status: 'asking' });
  // A ref, not state, so a second tap in the same frame can't send a second request.
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const keepRef = useRef<ViewInstance>(null);
  useEffect(() => {
    // The design puts initial focus on the safe action, Keep member.
    if (keepRef.current) AccessibilityInfo.sendAccessibilityEvent(keepRef.current, 'focus');
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const removing = removal.status === 'removing';
  useBackLock(removing);
  const name = member.userName;

  /** Null once the account is no longer a member. */
  const attempt = async (): Promise<Removal | null> => {
    try {
      await repository.removeMember(project.projectId, member.userId);
      return null;
    } catch (error) {
      const failure = toRemoveFailure(error);
      if (failure.kind === 'alreadyGone') return null;
      if (failure.kind === 'owner') return { status: 'owner' };
      if (failure.kind === 'denied') return { status: 'denied', message: failure.message };
    }
    // No usable answer: ask the backend who is a member before saying either way.
    try {
      const current = await repository.getProjectMembers(project.projectId);
      const stillMember = current.members.some((m) => m.userId === member.userId);
      return stillMember ? { status: 'failed', message: removeFailed(name) } : null;
    } catch {
      return { status: 'failed', message: removeUnknown(name) };
    }
  };

  const remove = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRemoval({ status: 'removing' });
    const result = await attempt();
    inFlight.current = false;
    if (!mounted.current) return;
    if (result) setRemoval(result);
    else onRemoved();
  };

  if (removal.status === 'owner') return <OwnerRequired projectName={project.projectName} onBack={onBack} />;

  return (
    <TaskScreen title={`Remove ${name}?`} testID="remove-member-screen">
      <Stack.Screen options={{ gestureEnabled: !removing }} />
      <Text style={styles.subtitle}>{project.projectName}</Text>
      <Text style={styles.text}>
        {name} will lose access to this project’s boards and tasks. This does not delete their account or existing work.
      </Text>
      {removal.status === 'failed' || removal.status === 'denied' ? <ErrorBanner>{removal.message}</ErrorBanner> : null}
      {removal.status === 'denied' ? (
        <Button
          label="Back to members"
          size="lg"
          block
          style={styles.button}
          onPress={onBack}
          testID="back-to-members"
        />
      ) : (
        <View style={styles.actions}>
          <Button
            label={removing ? 'Removing…' : 'Remove member'}
            size="lg"
            block
            loading={removing}
            style={styles.button}
            onPress={() => void remove()}
            testID="confirm-remove"
          />
          <Button
            ref={keepRef}
            label="Keep member"
            variant="outline"
            size="lg"
            block
            disabled={removing}
            style={styles.button}
            onPress={onBack}
            testID="keep-member"
          />
        </View>
      )}
    </TaskScreen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 15, lineHeight: 22, color: colors.mutedForeground },
  text: { fontSize: 15, lineHeight: 22, color: colors.foreground },
  actions: { gap: 12 },
  button: { height: 48 },
});
