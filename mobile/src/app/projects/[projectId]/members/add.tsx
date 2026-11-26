import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';

import { SelectControl, controlStyles } from '../../../../components/form/fields';
import { MembersUnavailable } from '../../../../components/members/MembersUnavailable';
import { RoleSheet } from '../../../../components/members/RoleSheet';
import { ErrorBanner, TaskScreen } from '../../../../components/task/TaskScreen';
import { Button } from '../../../../components/ui';
import { useBoardRepository } from '../../../../data/BoardRepositoryContext';
import {
  NO_ACCOUNT_FOUND,
  ONLY_OWNER_MANAGES,
  ROLE_LABELS,
  SEARCHING_ACCOUNTS,
  SEARCH_FAILED,
  SELECTED_ACCOUNT,
  SELECTED_BY_EMAIL,
  addFailed,
  alreadyMember,
  findByEmail,
  ownerRoleRefused,
  searchAccounts,
  toAddFailure,
  type AccountCandidate,
  type MemberRole,
  type ProjectMemberDetails,
  type ProjectMembers,
} from '../../../../domain/members';
import { useBackLock, useProjectMembers } from '../../../../hooks/useProjectMembers';
import { colors, radius } from '../../../../theme/tokens';

/** How long typing pauses before the accounts are searched. */
const SEARCH_DELAY_MS = 300;

/** US-4: the Owner finds an existing account and adds it as a project member. */
export default function AddMemberScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
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

  if (state.status === 'ready' && state.project.role === 'OWNER') {
    return (
      <AddMemberForm
        project={state.project}
        onCancel={back}
        onAdded={(member) =>
          // Back to the members, which are read again from the backend.
          router.dismissTo({
            pathname: '/projects/[projectId]/members',
            params: {
              projectId,
              notice: 'added',
              name: member.userName,
              role: member.role,
            },
          })
        }
      />
    );
  }

  return (
    <TaskScreen title="Add a member" testID="add-member-screen">
      {state.status === 'ready' ? (
        <>
          <Text style={styles.subtitle}>{ONLY_OWNER_MANAGES}</Text>
          <Button
            label="Back to members"
            size="lg"
            block
            style={styles.button}
            onPress={back}
            testID="back-to-members"
          />
        </>
      ) : (
        <MembersUnavailable state={state} onRetry={retry} onBack={back} />
      )}
    </TaskScreen>
  );
}

type Search =
  { status: 'idle' } | { status: 'searching' } | { status: 'done'; results: AccountCandidate[] } | { status: 'failed' };

type Problem = { kind: 'alreadyMember'; name: string } | { kind: 'form'; message: string };

function AddMemberForm({
  project,
  onCancel,
  onAdded,
}: {
  project: ProjectMembers;
  onCancel: () => void;
  onAdded: (member: ProjectMemberDetails) => void;
}) {
  const repository = useBoardRepository();
  const { projectId, projectName } = project;
  // The members before any attempt, to tell an earlier member from one a lost answer added.
  const [before] = useState(project.members);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<Search>({ status: 'idle' });
  const [selected, setSelected] = useState<AccountCandidate | null>(null);
  const [role, setRole] = useState<MemberRole>('WRITER');
  const [roleSheet, setRoleSheet] = useState(false);
  const [focused, setFocused] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<TextInputInstance>(null);
  // A ref, not state, so a second tap in the same frame can't send a second request.
  const inFlight = useRef(false);
  /** Accounts whose last attempt ended without a usable answer. */
  const unknownOutcome = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Only the latest search may show its results. */
  const latestSearch = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  useBackLock(adding);

  const runSearch = async (term: string) => {
    const request = ++latestSearch.current;
    try {
      const { accounts, members } = await repository.getKnownAccounts(projectId);
      if (mounted.current && request === latestSearch.current) {
        setSearch({
          status: 'done',
          results: searchAccounts(term, accounts, members),
        });
      }
    } catch {
      if (mounted.current && request === latestSearch.current) setSearch({ status: 'failed' });
    }
  };

  const changeQuery = (value: string) => {
    setQuery(value);
    setSelected(null);
    setProblem(null);
    if (timer.current) clearTimeout(timer.current);
    latestSearch.current += 1;
    if (!value.trim()) {
      setSearch({ status: 'idle' });
      return;
    }
    setSearch({ status: 'searching' });
    timer.current = setTimeout(() => void runSearch(value), SEARCH_DELAY_MS);
  };

  const retrySearch = () => {
    setSearch({ status: 'searching' });
    void runSearch(query);
  };

  const select = (candidate: AccountCandidate) => {
    setSelected(candidate);
    setProblem(candidate.status === 'member' ? { kind: 'alreadyMember', name: candidate.userName } : null);
  };

  const chooseAnother = () => {
    changeQuery('');
    inputRef.current?.focus();
  };

  type Outcome = { member: ProjectMemberDetails } | { problem: Problem } | { noAccount: true };

  const attempt = async (target: string): Promise<Outcome> => {
    if (unknownOutcome.current.has(target)) {
      // The earlier attempt may have been saved: look before sending it again.
      try {
        const current = await repository.getProjectMembers(projectId);
        const member = findByEmail(current.members, target);
        if (member && !findByEmail(before, target)) return { member };
      } catch {
        return { problem: { kind: 'form', message: addFailed(target) } };
      }
    }
    try {
      return { member: await repository.addMember(projectId, target, role) };
    } catch (error) {
      const failure = toAddFailure(error);
      if (failure.kind === 'alreadyMember') return { problem: { kind: 'alreadyMember', name: target } };
      if (failure.kind === 'noAccount') return { noAccount: true };
      if (failure.kind === 'oneOwner') return { problem: { kind: 'form', message: ownerRoleRefused(target) } };
      if (failure.kind === 'refused') return { problem: { kind: 'form', message: failure.message } };
      unknownOutcome.current.add(target);
      return { problem: { kind: 'form', message: addFailed(target) } };
    }
  };

  const add = async () => {
    if (inFlight.current || !selected || selected.status === 'member') return;
    inFlight.current = true;
    setAdding(true);
    setProblem(null);
    const result = await attempt(selected.userName);
    inFlight.current = false;
    if (!mounted.current) return;
    setAdding(false);
    if ('member' in result) onAdded(result.member);
    else if ('noAccount' in result) {
      // The backend has no such account: as a search without results.
      setSelected(null);
      setSearch({ status: 'done', results: [] });
    } else setProblem(result.problem);
  };

  const searching = search.status === 'searching';

  return (
    <TaskScreen title="Add a member" avoidKeyboardOnAndroid testID="add-member-screen">
      <Stack.Screen options={{ gestureEnabled: !adding }} />
      <Text style={styles.subtitle}>{projectName} · Existing accounts only</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Find an account *</Text>
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={changeQuery}
          editable={!adding}
          autoFocus
          placeholder="Search by name or email"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Find an account, required"
          accessibilityHint="Search by name or email"
          accessibilityState={{ disabled: adding }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[controlStyles.control, styles.input, focused && controlStyles.focus, adding && styles.inputDisabled]}
          testID="account-input"
        />
      </View>

      {problem?.kind === 'alreadyMember' ? (
        <>
          <ErrorBanner>{alreadyMember(problem.name)}</ErrorBanner>
          <Button
            label="Choose another account"
            variant="outline"
            size="lg"
            block
            style={styles.button}
            onPress={chooseAnother}
            testID="choose-another"
          />
        </>
      ) : (
        <>
          {selected ? (
            <View
              style={styles.account}
              accessible
              accessibilityLabel={`${selected.userName}, ${selected.status === 'byEmail' ? SELECTED_BY_EMAIL : SELECTED_ACCOUNT}`}
              testID="selected-account"
            >
              <Text style={styles.accountName}>{selected.userName}</Text>
              <Text style={styles.accountNote}>
                {selected.status === 'byEmail' ? SELECTED_BY_EMAIL : SELECTED_ACCOUNT}
              </Text>
            </View>
          ) : (
            <SearchResults search={search} onSelect={select} onRetry={retrySearch} />
          )}

          {selected ? (
            <View style={styles.field}>
              <Text style={styles.label}>Project role *</Text>
              <SelectControl
                label="Project role"
                value={ROLE_LABELS[role]}
                placeholder="Writer"
                disabled={adding}
                onPress={() => setRoleSheet(true)}
                testID="role-select"
              />
            </View>
          ) : null}

          {problem?.kind === 'form' ? <ErrorBanner>{problem.message}</ErrorBanner> : null}

          <View style={styles.actions}>
            <Button
              label={adding ? 'Adding…' : 'Add member'}
              size="lg"
              block
              disabled={!selected || searching}
              loading={adding}
              style={styles.button}
              onPress={() => void add()}
              testID="add-member-submit"
            />
            <Button
              label="Cancel"
              variant="outline"
              size="lg"
              block
              disabled={adding}
              style={styles.button}
              onPress={onCancel}
              testID="cancel-button"
            />
          </View>
        </>
      )}

      {roleSheet ? (
        <RoleSheet
          accountName={selected?.userName ?? 'the account'}
          role={role}
          onDone={(chosen) => {
            setRole(chosen);
            setRoleSheet(false);
            if (problem?.kind === 'form') setProblem(null);
          }}
          onClose={() => setRoleSheet(false)}
        />
      ) : null}
    </TaskScreen>
  );
}

/** Searching, the accounts found, none, or a failed search. */
function SearchResults({
  search,
  onSelect,
  onRetry,
}: {
  search: Search;
  onSelect: (candidate: AccountCandidate) => void;
  onRetry: () => void;
}) {
  if (search.status === 'idle') return null;
  if (search.status === 'searching') {
    return (
      <View
        style={styles.note}
        accessibilityRole="progressbar"
        accessibilityLiveRegion="polite"
        testID="account-searching"
      >
        <Text style={styles.noteText}>{SEARCHING_ACCOUNTS}</Text>
      </View>
    );
  }
  if (search.status === 'failed') {
    return (
      <View style={styles.field}>
        <Text
          style={styles.error}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          testID="account-search-error"
        >
          {SEARCH_FAILED}
        </Text>
        <Button
          label="Search again"
          variant="outline"
          size="lg"
          block
          style={styles.button}
          onPress={onRetry}
          testID="account-search-retry"
        />
      </View>
    );
  }
  if (search.results.length === 0) {
    return (
      <View style={styles.note} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="account-none">
        <Text style={styles.noteText}>{NO_ACCOUNT_FOUND}</Text>
      </View>
    );
  }
  return (
    <View
      style={styles.results}
      accessibilityLabel={`${search.results.length} accounts found`}
      testID="account-results"
    >
      {search.results.map((candidate) => {
        const detail =
          candidate.status === 'member'
            ? 'Already a project member'
            : candidate.status === 'byEmail'
              ? 'Add by email · checked when you add'
              : 'Existing account';
        return (
          <Pressable
            key={candidate.userName}
            accessibilityRole="button"
            accessibilityLabel={`${candidate.userName}, ${detail}`}
            accessibilityHint="Selects this account"
            onPress={() => onSelect(candidate)}
            style={({ pressed }) => [styles.account, pressed && styles.pressed]}
            testID={`account-option-${candidate.userName}`}
          >
            <Text style={styles.accountName}>{candidate.userName}</Text>
            <Text style={styles.accountNote}>{detail}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 15, lineHeight: 22, color: colors.mutedForeground },
  field: { gap: 8 },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: colors.foreground,
  },
  input: {
    minHeight: 48,
    fontSize: 16,
    color: colors.foreground,
    paddingVertical: 10,
  },
  inputDisabled: { color: colors.mutedForeground },
  error: { fontSize: 14, lineHeight: 20, color: colors.destructive },
  note: {
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
  },
  noteText: { fontSize: 14, lineHeight: 20, color: colors.foreground },
  results: { gap: 8 },
  account: {
    minHeight: 48,
    padding: 12,
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  pressed: { backgroundColor: colors.muted },
  accountName: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.foreground,
  },
  accountNote: { fontSize: 13, lineHeight: 18, color: colors.mutedForeground },
  actions: { gap: 12 },
  button: { height: 48 },
});
