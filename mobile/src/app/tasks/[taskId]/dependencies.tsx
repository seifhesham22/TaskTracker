import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';

import { AccessProblem, CheckingAccess } from '../../../components/access/AccessScreens';
import { SelectControl, SelectionSheet, controlStyles } from '../../../components/form/fields';
import { DependencyList, LinkCard, RelationBox } from '../../../components/task/Dependencies';
import { ErrorBanner, SuccessBanner, TaskScreen } from '../../../components/task/TaskScreen';
import { Button, Skeleton } from '../../../components/ui';
import { useBoardRepository } from '../../../data/BoardRepositoryContext';
import {
  CYCLE_TITLE,
  NOT_SAVED,
  RELATIONSHIP_LABELS,
  SEARCH_FAILED,
  SELECT_A_TASK,
  cycleExplanation,
  existingLabel,
  isAlreadyLinked,
  neverAddedNote,
  rejectedLabel,
  toCycleInfo,
  type CycleInfo,
  matchingTasks,
  relationshipHint,
  toAddDependencyError,
  toDependencyInput,
  type Relationship,
} from '../../../domain/dependencies';
import type { TaskDetails, TaskLink } from '../../../domain/models';
import { useTaskDetails } from '../../../hooks/useTaskDetails';
import { colors } from '../../../theme/tokens';

export const SEARCH_DELAY_MS = 300;
const READ_ONLY_NOTE = 'Only the project’s writers and owners can add dependencies.';

/** US-16: a task's dependencies, and adding one: which task must happen first. */
export default function TaskDependenciesScreen() {
  const { taskId, boardId } = useLocalSearchParams<{ taskId: string; boardId: string }>();
  const router = useRouter();
  const { state, retry, reload } = useTaskDetails(boardId, taskId);
  const [mode, setMode] = useState<'overview' | 'add'>('overview');
  const [added, setAdded] = useState(false);
  // Set while the add form shows a cycle the backend refused (the design titles it “Add dependency”).
  const [cycleShown, setCycleShown] = useState(false);
  // After a link is added following a refused cycle: the refused task's key, for the design's note.
  const [neverAdded, setNeverAdded] = useState<string | null>(null);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/tasks/[taskId]', params: { taskId, boardId } });
  };

  if (state.status === 'error') return <AccessProblem error={state.error} revoked={state.revoked} onRetry={retry} />;
  // Nothing of the task until the backend has confirmed access, and no action before it.
  if (state.status !== 'ready') return <CheckingAccess />;

  const { details } = state;
  const { task, projectName } = details;
  const openLink = (link: TaskLink) =>
    router.push({ pathname: '/tasks/[taskId]', params: { taskId: link.id, boardId: link.boardId } });

  return (
    <TaskScreen
      title={mode === 'add' && cycleShown ? 'Add dependency' : 'Task dependencies'}
      breadcrumb={[projectName, task.readableId].filter(Boolean).join(' / ')}
      onClose={close}
      testID="dependencies-screen"
    >
      {mode === 'add' ? (
        <AddDependencyForm
          details={details}
          onCancel={() => {
            setCycleShown(false);
            setMode('overview');
          }}
          onCycleShown={setCycleShown}
          onAdded={(rejectedKey) => {
            setAdded(true);
            setNeverAdded(rejectedKey);
            setCycleShown(false);
            setMode('overview');
            // Show the link as the backend now has it.
            reload();
          }}
        />
      ) : (
        <>
          {neverAdded ? null : <Text style={styles.subtitle}>{task.title}</Text>}
          {added ? <SuccessBanner>Dependency added</SuccessBanner> : null}
          <DependencyList task={task} onOpen={openLink} />
          {neverAdded ? (
            <>
              <Text style={styles.hint} testID="never-added-note">
                {neverAddedNote(neverAdded)}
              </Text>
              <Button label="Back to task" size="lg" block onPress={close} testID="back-to-task" />
            </>
          ) : details.canEdit ? (
            <Button
              label={added ? 'Add another dependency' : 'Add dependency'}
              size="lg"
              block
              onPress={() => {
                setAdded(false);
                setNeverAdded(null);
                setMode('add');
              }}
              testID="add-dependency-button"
            />
          ) : (
            <Text style={styles.hint} testID="read-only-note">
              {READ_ONLY_NOTE}
            </Text>
          )}
        </>
      )}
    </TaskScreen>
  );
}

type SearchState = { status: 'loading' } | { status: 'ready'; tasks: TaskLink[] } | { status: 'error' };

/** A link the backend refused because it would close a cycle, with what was asked for. */
interface Rejection {
  cycle: CycleInfo;
  task: TaskLink;
  relationship: Relationship;
}

function AddDependencyForm({
  details,
  onCancel,
  onAdded,
  onCycleShown,
}: {
  details: TaskDetails;
  onCancel: () => void;
  /** `rejectedKey`: the task of a refused cycle before this success, if there was one. */
  onAdded: (rejectedKey: string | null) => void;
  onCycleShown: (shown: boolean) => void;
}) {
  const repository = useBoardRepository();
  const { task, projectId } = details;
  const [relationship, setRelationship] = useState<Relationship>('blockedBy');
  const [term, setTerm] = useState('');
  const [search, setSearch] = useState<SearchState>({ status: 'loading' });
  const [searchKey, setSearchKey] = useState(0);
  const [selected, setSelected] = useState<TaskLink | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [relationshipSheet, setRelationshipSheet] = useState(false);
  // A refused cycle stays on screen, with its explanation, until a link is added or the form is left.
  const [rejection, setRejection] = useState<Rejection | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const searchRef = useRef<TextInputInstance>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Search the project's tasks a moment after typing stops; only the latest answer is used. The
  // handlers that start a search show it as loading.
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      repository.searchTasks(projectId, term).then(
        (found) => active && setSearch({ status: 'ready', tasks: matchingTasks(found, term, task.id) }),
        () => active && setSearch({ status: 'error' }),
      );
    }, SEARCH_DELAY_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [repository, projectId, term, task.id, searchKey]);

  const choose = (link: TaskLink) => {
    setSelected(link);
    setFieldError(null);
    setFormError(null);
  };

  const add = async () => {
    if (inFlight.current) return;
    if (!selected) {
      setFieldError(SELECT_A_TASK);
      searchRef.current?.focus();
      return;
    }
    const input = toDependencyInput(relationship, task.id, selected.id);
    inFlight.current = true;
    setAdding(true);
    setFormError(null);
    try {
      await repository.addDependency(input.blockingTaskId, input.blockedTaskId);
      if (mounted.current) onAdded(rejection?.task.readableId ?? null);
    } catch (error) {
      if (!mounted.current) return;
      // Nothing is shown as added: the list on screen is only ever what the backend returns.
      const cycle = toCycleInfo(error);
      if (cycle) {
        setRejection({ cycle, task: selected, relationship });
        setCorrecting(false);
        onCycleShown(true);
      } else {
        // Keep the selection and the direction, so the same link can be tried again.
        setRejection(null);
        onCycleShown(false);
        setFormError(toAddDependencyError(error));
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setAdding(false);
    }
  };

  const loading = search.status === 'loading' && !selected;
  const current = { readableId: task.readableId, title: task.title };
  const reviewing = !!rejection && !correcting;

  const chooseAnother = () => {
    setCorrecting(true);
    setSelected(null);
    setTerm('');
    setSearch({ status: 'loading' });
    setSearchKey((k) => k + 1);
  };

  const submitLabel = adding
    ? 'Adding…'
    : loading
      ? 'Loading…'
      : rejection && selected
        ? `Retry with ${selected.readableId}`
        : 'Add dependency';

  return (
    <View style={styles.form}>
      {rejection ? null : (
      <View style={styles.intro}>
        <Text style={styles.subtitle}>{task.title}</Text>
        <Text style={styles.current} testID="current-task">
          CURRENT TASK · {task.readableId} {task.title}
        </Text>
      </View>
      )}

      <View style={styles.field}>
        <Text style={styles.label}>Relationship</Text>
        <SelectControl
          label="Relationship"
          value={RELATIONSHIP_LABELS[relationship]}
          placeholder="Blocked by"
          disabled={adding || reviewing}
          onPress={() => setRelationshipSheet(true)}
          testID="relationship-select"
        />
        {rejection ? null : (
          <Text style={styles.hint} testID="relationship-hint">
            {relationshipHint(relationship, task.readableId)}
          </Text>
        )}
      </View>

      {rejection ? (
        <>
          <LinkCard link={rejection.task} testID={`rejected-${rejection.task.id}`} />
          <View style={styles.cycleAlert} accessibilityRole="alert" accessibilityLiveRegion="assertive" testID="cycle-error">
            <Text style={styles.cycleTitle}>{CYCLE_TITLE}</Text>
            <Text style={styles.cycleText}>{cycleExplanation(rejection.cycle)}</Text>
          </View>
          <View style={styles.cycleSummary} testID="cycle-summary">
            <Text style={styles.cycleLine}>{existingLabel(rejection.cycle)}</Text>
            <Text style={styles.cycleLine}>{rejectedLabel(rejection.cycle)}</Text>
            <Text style={[styles.cycleLine, styles.bold]}>{NOT_SAVED}</Text>
          </View>
        </>
      ) : null}

      {reviewing ? (
        <>
          <Button label="Choose another task" size="lg" block onPress={chooseAnother} testID="choose-another-task" />
          <Button label="Cancel" variant="outline" size="lg" block onPress={onCancel} testID="cancel-button" />
        </>
      ) : (
      <>
      <View style={styles.field}>
        <Text style={styles.label}>{rejection ? 'Choose another task' : 'Find a task *'}</Text>
        <TextInput
          ref={searchRef}
          value={term}
          onChangeText={(value) => {
            setTerm(value);
            setSearch({ status: 'loading' });
            setFieldError(null);
          }}
          editable={!adding}
          placeholder={rejection ? 'Search tasks…' : 'Search by title or task key'}
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Find a task"
          accessibilityHint={fieldError ?? undefined}
          aria-invalid={!!fieldError}
          style={[controlStyles.control, styles.input, !!fieldError && controlStyles.invalid]}
          testID="task-search-input"
        />
        {fieldError ? (
          <Text style={styles.error} accessibilityRole="alert" testID="task-search-error">
            {fieldError}
          </Text>
        ) : null}
      </View>

      {selected ? (
        <LinkCard link={selected} selected testID={`selected-${selected.id}`} />
      ) : search.status === 'loading' ? (
        <View style={styles.loading} accessibilityLabel="Loading matching tasks" testID="search-loading">
          <Skeleton width="100%" height={52} />
          <Text style={styles.hint} accessibilityLiveRegion="polite">
            Loading matching tasks…
          </Text>
        </View>
      ) : search.status === 'error' ? (
        <View style={styles.loading}>
          <Text style={styles.error} accessibilityRole="alert" testID="search-error">
            {SEARCH_FAILED}
          </Text>
          <Button label="Try again" variant="outline" size="lg" block onPress={() => {
              setSearch({ status: 'loading' });
              setSearchKey((k) => k + 1);
            }}
          />
        </View>
      ) : search.tasks.length === 0 ? (
        <Text style={styles.hint} testID="search-empty">
          No other tasks in this project match “{term.trim()}”.
        </Text>
      ) : (
        <View style={styles.results} testID="search-results">
          {search.tasks.map((link) => {
            const linked = isAlreadyLinked(task, relationship, link.id);
            // The refused task, the same way round, would only be refused again.
            const refused = !!rejection && rejection.relationship === relationship && rejection.task.id === link.id;
            return (
              <LinkCard
                key={link.id}
                link={link}
                disabled={linked || refused || adding}
                note={refused ? 'Creates a cycle' : linked ? 'Already linked' : undefined}
                onPress={() => choose(link)}
                testID={`result-${link.id}`}
              />
            );
          })}
        </View>
      )}

      {selected ? (
        <>
          <RelationBox
            first={relationship === 'blockedBy' ? selected : current}
            then={relationship === 'blockedBy' ? current : selected}
            testID="relation-preview"
          />
          {!adding ? (
            <Button
              label="Choose another task"
              variant="ghost"
              size="lg"
              block
              onPress={() => setSelected(null)}
              testID="change-selection"
            />
          ) : null}
        </>
      ) : null}

      {formError ? <ErrorBanner>{formError}</ErrorBanner> : null}

      <Button
        label={submitLabel}
        size="lg"
        block
        loading={adding}
        disabled={loading}
        onPress={() => void add()}
        testID="submit-dependency"
      />
      {!adding ? <Button label="Cancel" variant="outline" size="lg" block onPress={onCancel} testID="cancel-button" /> : null}
      </>
      )}

      <SelectionSheet
        visible={relationshipSheet}
        title="Relationship"
        testID="relationship-sheet"
        selectedKey={relationship}
        options={(['blockedBy', 'blocks'] as const).map((key) => ({
          key,
          label: RELATIONSHIP_LABELS[key],
          detail: key === 'blockedBy' ? 'It must happen first' : 'It waits for this task',
        }))}
        onSelect={(key) => {
          setRelationship(key as Relationship);
          setRelationshipSheet(false);
          if (selected && isAlreadyLinked(task, key as Relationship, selected.id)) setSelected(null);
        }}
        onClose={() => setRelationshipSheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  form: { gap: 16 },
  intro: { gap: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, color: colors.mutedForeground },
  current: { fontSize: 11, lineHeight: 16, letterSpacing: 0.3, color: colors.mutedForeground },
  field: { gap: 8 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.foreground },
  input: { fontSize: 16, color: colors.foreground, paddingVertical: 10 },
  hint: { fontSize: 12, lineHeight: 16, color: colors.mutedForeground },
  error: { fontSize: 14, lineHeight: 20, color: colors.destructive },
  loading: { gap: 8 },
  results: { gap: 8 },
  cycleAlert: {
    padding: 14,
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.destructiveBorder,
    backgroundColor: colors.destructiveTint,
  },
  cycleTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.destructive },
  cycleText: { fontSize: 14, lineHeight: 20, color: colors.destructive },
  cycleSummary: { padding: 12, gap: 4, borderRadius: 8, backgroundColor: colors.muted },
  cycleLine: { fontSize: 14, lineHeight: 20, color: colors.foreground },
  bold: { fontWeight: '700' },
});
