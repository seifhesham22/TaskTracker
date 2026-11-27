import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AccessProblem, CheckingAccess } from '../../../components/access/AccessScreens';
import { controlStyles } from '../../../components/form/fields';
import { ErrorBanner, SuccessBanner, TaskScreen, breadcrumbFor } from '../../../components/task/TaskScreen';
import { Button, Skeleton } from '../../../components/ui';
import {
  ASSIGNEE_UPDATED,
  ASSIGNMENT_FAILED,
  ASSIGNMENT_REMOVED,
  LOADING_MEMBERS,
  MEMBERSHIP_REMOVED,
  NO_LONGER_MEMBER,
  NO_MATCHING_MEMBERS,
  READER_VIEW,
  REMOVE_ASSIGNMENT_DETAIL,
  UNASSIGNED,
  assigneeLabel,
  canManageAssignees,
  currentAssignees,
  isChange,
  memberDetail,
  searchMembers,
} from '../../../domain/assignee';
import { initials } from '../../../domain/format';
import { PRIORITY_LABELS, type ProjectMember, type TaskDetails } from '../../../domain/models';
import { useAssigneeChange } from '../../../hooks/useAssigneeChange';
import { useTaskDetails } from '../../../hooks/useTaskDetails';
import { colors, radius } from '../../../theme/tokens';

type Notice = { tone: 'success' | 'error'; message: string } | null;

/**
 * US-12: who is responsible for a task, and, for the project's Owners and Writers, changing it to
 * another member of the task's project or to no one. Everything shown comes from the backend.
 */
export default function TaskAssigneeScreen() {
  const { taskId, boardId } = useLocalSearchParams<{ taskId: string; boardId: string }>();
  const router = useRouter();
  const task = useTaskDetails(boardId, taskId, { poll: true });
  const { state } = task;
  const [picking, setPicking] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/tasks/[taskId]', params: { taskId, boardId } });
  };

  // Nothing of the task until the backend has confirmed access.
  if (state.status === 'loading') return <CheckingAccess />;
  if (state.status === 'error') return <AccessProblem error={state.error} revoked={state.revoked} onRetry={task.retry} />;

  const { details } = state;
  const allowed = canManageAssignees(details.projectRole);

  if (picking && allowed) {
    return (
      <ChangeAssignee
        details={details}
        boardId={boardId}
        loadingMembers={state.refreshing}
        onCancel={() => setPicking(false)}
        // Read the task and the project's members again, after every attempt: what is shown is
        // always the backend's, never the choice that was sent.
        reread={task.reload}
        recheckAccess={task.recheck}
        onSaved={(removed) => {
          setNotice({ tone: 'success', message: removed ? ASSIGNMENT_REMOVED : ASSIGNEE_UPDATED });
          setPicking(false);
        }}
        onNotAllowed={(message) => {
          task.reload();
          setNotice({ tone: 'error', message });
          setPicking(false);
        }}
      />
    );
  }

  const { task: saved, projectName } = details;
  const assignees = currentAssignees(saved, details.members);
  const meta = [saved.columnName, saved.priority ? `${PRIORITY_LABELS[saved.priority]} priority` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <TaskScreen
      title="Task assignee"
      onClose={close}
      refreshing={state.refreshing}
      onRefresh={task.refresh}
      testID="task-assignee-screen"
    >
      <Text style={styles.subtitle}>{breadcrumbFor(projectName, saved.readableId)}</Text>
      <View style={styles.card} testID="assignee-task-card">
        <Text style={styles.cardTitle}>{saved.title}</Text>
        {meta ? <Text style={styles.cardMeta}>{meta}</Text> : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Assignee</Text>
        <View style={styles.value} accessible accessibilityLabel={`Assignee: ${assignees.map((a) => a.userName).join(', ') || UNASSIGNED}`} testID="assignee-value">
          {assignees.length === 0 ? (
            <Text style={styles.valueText}>{UNASSIGNED}</Text>
          ) : (
            assignees.map((a) => (
              <Text key={a.userId} style={styles.valueText}>
                {assigneeLabel(a.userName)}
              </Text>
            ))
          )}
        </View>
      </View>

      {notice?.tone === 'success' ? <SuccessBanner>{notice.message}</SuccessBanner> : null}
      {notice?.tone === 'error' ? <ErrorBanner>{notice.message}</ErrorBanner> : null}

      {allowed ? (
        <Button
          label="Change assignee"
          size="lg"
          block
          style={styles.button}
          onPress={() => {
            setNotice(null);
            setPicking(true);
            // The members who may be chosen are read again before saving is possible.
            task.refresh();
          }}
          testID="change-assignee-button"
        />
      ) : (
        <View style={styles.note} testID="assignee-reader-note">
          <Text style={styles.noteText}>{READER_VIEW}</Text>
        </View>
      )}
    </TaskScreen>
  );
}

function ChangeAssignee({
  details,
  boardId,
  loadingMembers,
  onCancel,
  reread,
  recheckAccess,
  onSaved,
  onNotAllowed,
}: {
  details: TaskDetails;
  boardId: string;
  loadingMembers: boolean;
  onCancel: () => void;
  reread: () => void;
  recheckAccess: () => Promise<'kept' | 'lost' | 'unverified'>;
  onSaved: (removed: boolean) => void;
  onNotAllowed: (message: string) => void;
}) {
  const { task, members } = details;
  const saved = task.assigneeIds;
  // The draft choice: a member's ID, null for Unassigned, undefined before a choice is possible.
  const [chosen, setChosen] = useState<string | null | undefined>(
    saved.length === 0 ? null : saved.length === 1 ? saved[0] : undefined,
  );
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** A member the backend says is no longer in the project: shown, but can't be saved. */
  const [gone, setGone] = useState<ProjectMember | null>(null);
  const change = useAssigneeChange({ taskId: task.id, boardId, savedAssignees: saved });
  /** Saved: the task is being read again before the new assignee is shown. */
  const [finishing, setFinishing] = useState(false);
  const saving = change.saving || finishing;

  const found = searchMembers(members, query);
  const goneShown = gone && !members.some((m) => m.userId === gone.userId) ? gone : null;
  const options = goneShown ? [...found, goneShown] : found;
  const noMatch = !loadingMembers && query.trim() !== '' && found.length === 0 && !goneShown;
  const removing = chosen === null && saved.length > 0;
  const canSave =
    !loadingMembers &&
    !noMatch &&
    chosen !== undefined &&
    chosen !== goneShown?.userId &&
    (chosen === null || members.some((m) => m.userId === chosen)) &&
    isChange(saved, chosen);
  const othersReplaced = chosen !== undefined && saved.filter((id) => id !== chosen).length > 1;

  const choose = (id: string | null) => {
    if (saving) return;
    setChosen(id);
    setError(null);
  };

  const submit = async () => {
    if (!canSave || chosen === undefined) return;
    setError(null);
    const outcome = await change.save(chosen);
    if (!outcome) return;
    if (outcome.status === 'saved') {
      // Shown only once the task has been read again: the assignee is the backend's, not the choice.
      setFinishing(true);
      const read = await recheckAccess();
      if (read === 'kept') onSaved(outcome.removed);
      else setFinishing(false);
      return;
    }
    const { failure } = outcome;
    if (failure.kind === 'noAccess') {
      // Not a member any more, or the task is gone: the same check as when the app resumes.
      if ((await recheckAccess()) === 'kept') {
        reread();
        setError(ASSIGNMENT_FAILED);
      }
      return;
    }
    if (failure.kind === 'notAllowed') {
      onNotAllowed(failure.message);
      return;
    }
    // Whatever happened, show what the backend has now (a change may have been saved in part).
    reread();
    if (failure.kind === 'notMember') {
      const member = members.find((m) => m.userId === chosen);
      if (member) setGone(member);
      setError(NO_LONGER_MEMBER);
    } else setError(failure.kind === 'form' ? failure.message : ASSIGNMENT_FAILED);
  };

  return (
    <TaskScreen title="Change assignee" avoidKeyboardOnAndroid testID="change-assignee-screen">
      <Text style={styles.subtitle}>
        {task.readableId} · {task.title}
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>Find a project member</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          editable={!saving}
          placeholder="Search members…"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Find a project member"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[controlStyles.control, styles.input, focused && controlStyles.focus]}
          testID="member-search"
        />
      </View>

      {loadingMembers ? (
        <View style={styles.list}>
          <Skeleton width="100%" height={56} />
          <View style={styles.note} accessibilityRole="progressbar" accessibilityLiveRegion="polite" testID="members-loading">
            <Text style={styles.noteText}>{LOADING_MEMBERS}</Text>
          </View>
        </View>
      ) : noMatch ? (
        <View style={styles.note} accessibilityLiveRegion="polite" testID="members-none">
          <Text style={styles.noteText}>{NO_MATCHING_MEMBERS}</Text>
        </View>
      ) : (
        <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel="Assignee">
          <Option
            mark="–"
            title={UNASSIGNED}
            detail={REMOVE_ASSIGNMENT_DETAIL}
            selected={chosen === null}
            disabled={saving}
            onPress={() => choose(null)}
            testID="option-unassigned"
          />
          {options.map((member) => (
            <Option
              key={member.userId}
              mark={initials(member.userName)}
              title={member.userName}
              detail={member.userId === goneShown?.userId ? MEMBERSHIP_REMOVED : memberDetail(member)}
              selected={chosen === member.userId}
              disabled={saving}
              onPress={() => choose(member.userId)}
              testID={`option-${member.userId}`}
            />
          ))}
        </View>
      )}

      {othersReplaced ? (
        <Text style={styles.hint} testID="replaces-note">
          Saving replaces the current assignees:{' '}
          {currentAssignees(task, members)
            .map((a) => a.userName)
            .join(', ')}
          .
        </Text>
      ) : null}

      {error ? <ErrorBanner>{error}</ErrorBanner> : null}

      <View style={styles.actions}>
        <Button
          label={saving ? 'Saving…' : removing ? 'Remove assignment' : 'Save changes'}
          size="lg"
          block
          disabled={!canSave}
          loading={saving}
          style={styles.button}
          onPress={() => void submit()}
          testID="save-assignee"
        />
        <Button
          label="Cancel"
          variant="outline"
          size="lg"
          block
          disabled={saving}
          style={styles.button}
          onPress={onCancel}
          testID="cancel-assignee"
        />
      </View>
    </TaskScreen>
  );
}

function Option({
  mark,
  title,
  detail,
  selected,
  disabled,
  onPress,
  testID,
}: {
  mark: string;
  title: string;
  detail: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={`${title}, ${detail}`}
      disabled={disabled}
      onPress={onPress}
      style={[styles.option, selected && styles.optionSelected]}
      testID={testID}
    >
      <View style={styles.mark}>
        <Text style={styles.markText}>{mark}</Text>
      </View>
      <View style={styles.optionText}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionDetail}>{detail}</Text>
      </View>
      <View style={styles.radio}>{selected ? <View style={styles.radioDot} /> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
  card: { padding: 14, gap: 2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.card },
  cardTitle: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.foreground },
  cardMeta: { fontSize: 13, lineHeight: 18, color: colors.mutedForeground },
  field: { gap: 8 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.foreground },
  value: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  valueText: { fontSize: 16, lineHeight: 22, color: colors.foreground },
  input: { minHeight: 48, fontSize: 16, color: colors.foreground, paddingVertical: 10 },
  note: { padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.muted },
  noteText: { fontSize: 14, lineHeight: 20, color: colors.foreground },
  hint: { fontSize: 13, lineHeight: 18, color: colors.mutedForeground },
  list: { gap: 8 },
  option: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  optionSelected: { borderColor: colors.foreground, backgroundColor: colors.muted },
  mark: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.muted },
  markText: { fontSize: 12, fontWeight: '600', color: colors.foreground },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.foreground },
  optionDetail: { fontSize: 13, lineHeight: 18, color: colors.mutedForeground },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.foreground, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.foreground },
  actions: { gap: 12 },
  button: { height: 48 },
});
