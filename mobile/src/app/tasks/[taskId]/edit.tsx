import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { AccessProblem, CheckingAccess } from '../../../components/access/AccessScreens';
import { SelectControl, SelectionSheet, controlStyles } from '../../../components/form/fields';
import { DateField } from '../../../components/task/DateField';
import {
  DiscardChangesDialog,
  ErrorBanner,
  TaskScreen,
  breadcrumbFor,
} from '../../../components/task/TaskScreen';
import { Button } from '../../../components/ui';
import { useBoardRepository } from '../../../data/BoardRepositoryContext';
import { PRIORITY_LABELS, TASK_PRIORITIES, TITLE_MAX_LENGTH, type TaskDetails, type TaskPriority } from '../../../domain/models';
import { useEditTaskForm } from '../../../hooks/useEditTaskForm';
import { useTaskDetails } from '../../../hooks/useTaskDetails';
import { colors, radius } from '../../../theme/tokens';

const NO_PRIORITY = '__none__';

/** US-11: edit a task's title, description, priority, start date and due date. */
export default function EditTaskScreen() {
  const { taskId, boardId } = useLocalSearchParams<{ taskId: string; boardId: string }>();
  const router = useRouter();
  const { state, retry } = useTaskDetails(boardId, taskId);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/tasks/[taskId]', params: { taskId, boardId } });
  };

  if (state.status === 'ready') {
    return (
      <EditTaskForm
        key={state.details.task.id}
        details={state.details}
        onLeave={leave}
        onSaved={() =>
          // Back to Task details, which reads the task again from the backend.
          router.dismissTo({ pathname: '/tasks/[taskId]', params: { taskId, boardId, updated: '1' } })
        }
      />
    );
  }

  if (state.status === 'error') return <AccessProblem error={state.error} revoked={state.revoked} onRetry={retry} />;

  // Nothing of the task until the backend has confirmed access, and no action before it.
  return <CheckingAccess />;
}

function EditTaskForm({
  details,
  onLeave,
  onSaved,
}: {
  details: TaskDetails;
  onLeave: () => void;
  onSaved: () => void;
}) {
  const repository = useBoardRepository();
  const { task, projectName } = details;
  const form = useEditTaskForm({ task, updateTask: repository.updateTask, onSaved });
  const [prioritySheet, setPrioritySheet] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [focused, setFocused] = useState<'title' | 'description' | null>(null);
  const { values, errors, saving } = form;
  const titleLength = values.title.trim().length;

  // Cancel and the close button: leave at once when nothing changed, otherwise ask first.
  const cancel = () => {
    if (saving) return;
    if (form.dirty) setConfirmDiscard(true);
    else onLeave();
  };

  return (
    <TaskScreen
      title="Edit task"
      breadcrumb={breadcrumbFor(projectName, task.readableId)}
      onClose={cancel}
      closeDisabled={saving}
      testID="edit-task-screen"
    >
      {errors.form ? <ErrorBanner>{errors.form}</ErrorBanner> : null}

      <View style={styles.field}>
        <Text style={styles.label}>Title *</Text>
        <TextInput
          value={values.title}
          onChangeText={form.setTitle}
          editable={!saving}
          placeholder="Task title"
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="next"
          accessibilityLabel="Title"
          accessibilityHint={errors.title}
          aria-invalid={!!errors.title}
          onFocus={() => setFocused('title')}
          onBlur={() => setFocused(null)}
          style={[
            controlStyles.control,
            styles.input,
            focused === 'title' && controlStyles.focus,
            !!errors.title && controlStyles.invalid,
            saving && styles.inputDisabled,
          ]}
          testID="title-input"
        />
        {errors.title ? (
          <Text style={styles.error} accessibilityRole="alert" testID="title-error">
            {errors.title}
          </Text>
        ) : null}
        <Text style={[styles.hint, titleLength > TITLE_MAX_LENGTH && styles.hintOver]} testID="title-counter">
          {titleLength} / {TITLE_MAX_LENGTH} characters
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          value={values.description}
          onChangeText={form.setDescription}
          editable={!saving}
          placeholder="Add more detail (optional)"
          placeholderTextColor={colors.mutedForeground}
          multiline
          textAlignVertical="top"
          accessibilityLabel="Description"
          onFocus={() => setFocused('description')}
          onBlur={() => setFocused(null)}
          style={[
            controlStyles.control,
            styles.input,
            styles.textarea,
            focused === 'description' && controlStyles.focus,
            saving && styles.inputDisabled,
          ]}
          testID="description-input"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Priority</Text>
        <SelectControl
          label="Priority"
          value={values.priority ? PRIORITY_LABELS[values.priority] : null}
          placeholder="No priority"
          disabled={saving}
          onPress={() => setPrioritySheet(true)}
          testID="priority-select"
        />
      </View>

      <View>
        <View style={styles.dates}>
          <View style={[styles.field, styles.date]}>
            <Text style={styles.label}>Start date</Text>
            <DateField
              label="Start date"
              value={values.startDate}
              onChange={form.setStartDate}
              invalid={!!errors.startDate}
              disabled={saving}
              testID="start-date"
            />
          </View>
          <View style={[styles.field, styles.date]}>
            <Text style={styles.label}>Due date</Text>
            <DateField
              label="Due date"
              value={values.dueDate}
              onChange={form.setDueDate}
              invalid={!!errors.dueDate}
              disabled={saving}
              testID="due-date"
            />
          </View>
        </View>
        {errors.startDate ? (
          <Text style={[styles.error, styles.dateError]} accessibilityRole="alert" testID="start-date-error">
            {errors.startDate}
          </Text>
        ) : null}
        {errors.dueDate ? (
          <Text style={[styles.error, styles.dateError]} accessibilityRole="alert" testID="due-date-error">
            {errors.dueDate}
          </Text>
        ) : null}
        <Text style={[styles.hint, styles.requiredNote]}>Only Title is required.</Text>
      </View>

      <View style={styles.actions}>
        <Button
          label="Cancel"
          variant="outline"
          size="lg"
          style={styles.action}
          disabled={saving}
          onPress={cancel}
          testID="cancel-button"
        />
        <Button
          label={saving ? 'Saving…' : 'Save changes'}
          size="lg"
          style={styles.action}
          loading={saving}
          disabled={!form.dirty}
          onPress={form.save}
          testID="save-button"
        />
      </View>

      <SelectionSheet
        visible={prioritySheet}
        title="Priority"
        testID="priority-sheet"
        selectedKey={values.priority ?? NO_PRIORITY}
        options={[
          { key: NO_PRIORITY, label: 'No priority' },
          ...TASK_PRIORITIES.map((p) => ({ key: p, label: PRIORITY_LABELS[p] })),
        ]}
        onSelect={(key) => {
          form.setPriority(key === NO_PRIORITY ? null : (key as TaskPriority));
          setPrioritySheet(false);
        }}
        onClose={() => setPrioritySheet(false)}
      />
      <DiscardChangesDialog
        visible={confirmDiscard}
        onKeepEditing={() => setConfirmDiscard(false)}
        onDiscard={() => {
          setConfirmDiscard(false);
          onLeave();
        }}
      />
    </TaskScreen>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.foreground },
  input: { fontSize: 16, color: colors.foreground, paddingVertical: 10 },
  inputDisabled: { color: colors.mutedForeground },
  textarea: { minHeight: 64, borderRadius: radius.md },
  hint: { fontSize: 12, lineHeight: 16, color: colors.mutedForeground },
  hintOver: { color: colors.destructive },
  error: { fontSize: 14, lineHeight: 20, color: colors.destructive },
  dates: { flexDirection: 'row', gap: 8 },
  date: { flex: 1 },
  dateError: { marginTop: 8 },
  requiredNote: { marginTop: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  action: { flex: 1 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
});
