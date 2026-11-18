import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';

import { BoardState } from '../../../components/board/BoardState';
import { controlStyles } from '../../../components/form/fields';
import { ErrorBanner, TaskFormSkeleton, TaskScreen, breadcrumbFor } from '../../../components/task/TaskScreen';
import { Button } from '../../../components/ui';
import { useBoardRepository } from '../../../data/BoardRepositoryContext';
import type { CreateTaskInput, TaskDetails } from '../../../domain/models';
import { toSubtaskErrors, validateSubtaskTitle, type SubtaskErrors } from '../../../domain/subtask';
import { useTaskDetails } from '../../../hooks/useTaskDetails';
import { colors, radius } from '../../../theme/tokens';

/** US-13: create a subtask of the task in the route. Only the title is asked for. */
export default function CreateSubtaskScreen() {
  const { taskId, boardId } = useLocalSearchParams<{ taskId: string; boardId: string }>();
  const router = useRouter();
  const { state, retry } = useTaskDetails(boardId, taskId);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/tasks/[taskId]', params: { taskId, boardId } });
  };

  if (state.status === 'ready') {
    return (
      <CreateSubtaskForm
        parent={state.details}
        onLeave={leave}
        onCreated={() =>
          // Back to the parent, which reads its subtasks again from the backend.
          router.dismissTo({ pathname: '/tasks/[taskId]', params: { taskId, boardId, created: '1' } })
        }
      />
    );
  }

  return (
    <TaskScreen title="Create subtask" onClose={leave} testID="create-subtask-screen">
      {state.status === 'loading' ? (
        <TaskFormSkeleton />
      ) : (
        <View style={styles.state}>
          {state.error.kind === 'notFound' ? (
            <BoardState type="notfound" title="Task not found" description={state.error.message} action="Go back" onAction={leave} />
          ) : (
            <BoardState type="error" title="Couldn’t load this task" description={state.error.message} onAction={retry} />
          )}
        </View>
      )}
    </TaskScreen>
  );
}

function CreateSubtaskForm({
  parent,
  onLeave,
  onCreated,
}: {
  parent: TaskDetails;
  onLeave: () => void;
  onCreated: () => void;
}) {
  const repository = useBoardRepository();
  const { task, projectName } = parent;
  const [title, setTitle] = useState('');
  const [errors, setErrors] = useState<SubtaskErrors>({});
  const [checked, setChecked] = useState(false);
  const [creating, setCreating] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInputInstance>(null);
  // A ref, not state, so a second tap in the same frame can't create a second subtask.
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const changeTitle = (value: string) => {
    setTitle(value);
    // After the first submit, the message follows what is typed.
    if (checked) setErrors((e) => ({ form: e.form, title: validateSubtaskTitle(value) ?? undefined }));
  };

  const create = async () => {
    if (inFlight.current) return;
    setChecked(true);
    const titleError = validateSubtaskTitle(title);
    if (titleError) {
      setErrors({ title: titleError });
      inputRef.current?.focus();
      return;
    }

    // The new task goes on the parent's board (the backend puts it in the first column) under the parent.
    const input: CreateTaskInput = { boardId: task.boardId, title: title.trim(), parentTaskId: task.id };
    inFlight.current = true;
    setCreating(true);
    setErrors({});
    try {
      await repository.createTask(input);
      if (mounted.current) onCreated();
    } catch (error) {
      if (!mounted.current) return;
      const found = toSubtaskErrors(error, input);
      setErrors(found);
      if (found.title) inputRef.current?.focus();
    } finally {
      inFlight.current = false;
      if (mounted.current) setCreating(false);
    }
  };

  return (
    <TaskScreen
      title="Create subtask"
      breadcrumb={breadcrumbFor(projectName, task.readableId)}
      onClose={onLeave}
      closeDisabled={creating}
      testID="create-subtask-screen"
    >
      <View style={styles.parent} testID="parent-task" accessibilityLabel={`Parent task ${task.readableId}, ${task.title}`}>
        <Text style={styles.parentLabel}>PARENT TASK</Text>
        <Text style={styles.parentText} numberOfLines={2}>
          <Text style={styles.parentKey}>{task.readableId}</Text> · {task.title}
        </Text>
      </View>

      {errors.form ? <ErrorBanner>{errors.form}</ErrorBanner> : null}

      <View style={styles.field}>
        <Text style={styles.label}>Subtask title *</Text>
        <TextInput
          ref={inputRef}
          value={title}
          onChangeText={changeTitle}
          editable={!creating}
          autoFocus
          placeholder="Enter a subtask title"
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="done"
          onSubmitEditing={() => void create()}
          accessibilityLabel="Subtask title"
          accessibilityHint={errors.title}
          aria-invalid={!!errors.title}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            controlStyles.control,
            styles.input,
            focused && controlStyles.focus,
            !!errors.title && controlStyles.invalid,
            creating && styles.inputDisabled,
          ]}
          testID="subtask-title-input"
        />
        {errors.title ? (
          <Text style={styles.error} accessibilityRole="alert" testID="subtask-title-error">
            {errors.title}
          </Text>
        ) : null}
        <Text style={styles.hint}>The new subtask will appear under {task.readableId}.</Text>
      </View>

      <View style={styles.actions}>
        <Button
          label="Cancel"
          variant="outline"
          size="lg"
          style={styles.action}
          disabled={creating}
          onPress={onLeave}
          testID="cancel-button"
        />
        <Button
          label={creating ? 'Creating…' : 'Create subtask'}
          size="lg"
          style={styles.action}
          loading={creating}
          onPress={() => void create()}
          testID="create-subtask-button"
        />
      </View>
    </TaskScreen>
  );
}

const styles = StyleSheet.create({
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  parent: { padding: 16, gap: 6, borderRadius: radius.lg, backgroundColor: colors.muted },
  parentLabel: { fontSize: 11, lineHeight: 16, letterSpacing: 0.3, color: colors.mutedForeground },
  parentText: { fontSize: 14, lineHeight: 20, color: colors.foreground },
  parentKey: { fontWeight: '700' },
  field: { gap: 8 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.foreground },
  input: { fontSize: 16, color: colors.foreground, paddingVertical: 10 },
  inputDisabled: { color: colors.mutedForeground },
  error: { fontSize: 14, lineHeight: 20, color: colors.destructive },
  hint: { fontSize: 12, lineHeight: 16, color: colors.mutedForeground },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  action: { flex: 1 },
});
