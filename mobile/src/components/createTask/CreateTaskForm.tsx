import { useState, type RefObject } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';

import { PRIORITY_LABELS, TASK_PRIORITIES, TITLE_MAX_LENGTH, type ProjectMember, type TaskPriority } from '../../domain/models';
import { notAMemberMessage } from '../../domain/createTaskErrors';
import type { CreateTaskFormController } from '../../hooks/useCreateTaskForm';
import { colors, radius } from '../../theme/tokens';
import { PriorityIcon } from '../board/markers';
import { DueDateField } from '../form/DueDateField';
import { Field, FormErrorAlert, SelectControl, SelectionSheet, controlStyles } from '../form/fields';
import { Avatar } from '../ui';

const UNASSIGNED = '__unassigned__';
const NO_PRIORITY = '__none__';

export function CreateTaskForm({
  form,
  titleInputRef,
  members,
  membersUnavailable,
  projectName = '',
  columnName,
}: {
  form: CreateTaskFormController;
  titleInputRef: RefObject<TextInputInstance | null>;
  members: ProjectMember[];
  membersUnavailable?: string;
  projectName?: string;
  columnName?: string;
}) {
  const { values, errors, generalError, submitting, onFieldLayout } = form;
  const [focused, setFocused] = useState<'title' | 'description' | null>(null);
  const [sheet, setSheet] = useState<'assignee' | 'priority' | null>(null);

  const assignee = values.assigneeId ? members.find((m) => m.userId === values.assigneeId) : undefined;
  const titleLength = values.title.trim().length;
  const assigneeError = errors.assigneeId && assignee ? notAMemberMessage(assignee.userName, projectName) : errors.assigneeId;

  return (
    <View style={styles.form}>
      {generalError ? <FormErrorAlert title={generalError.title} description={generalError.description} /> : null}

      <Text style={styles.hint}>
        Fields marked <Text style={{ color: colors.destructive }}>*</Text> are required.
        {columnName ? ` New tasks start in ${columnName}.` : ''}
      </Text>

      <Field
        label="Title"
        required
        error={errors.title}
        errorTestID="title-error"
        counter={`${titleLength}/${TITLE_MAX_LENGTH}`}
        counterOver={titleLength > TITLE_MAX_LENGTH}
        onLayout={onFieldLayout('title')} testID="field-title"
      >
        <TextInput
          ref={titleInputRef}
          value={values.title}
          onChangeText={form.setTitle}
          placeholder="e.g. Design the board screen"
          placeholderTextColor={colors.mutedForeground}
          editable={!submitting}
          autoFocus
          returnKeyType="next"
          accessibilityLabel="Title"
          accessibilityHint={errors.title ?? undefined}
          onFocus={() => setFocused('title')}
          onBlur={() => setFocused(null)}
          style={[
            controlStyles.control,
            styles.input,
            focused === 'title' && controlStyles.focus,
            errors.title && controlStyles.invalid,
          ]}
          testID="title-input"
        />
      </Field>

      <Field label="Description" onLayout={onFieldLayout('description')} testID="field-description">
        <TextInput
          value={values.description}
          onChangeText={form.setDescription}
          placeholder="Add more detail (optional)"
          placeholderTextColor={colors.mutedForeground}
          editable={!submitting}
          multiline
          textAlignVertical="top"
          accessibilityLabel="Description"
          onFocus={() => setFocused('description')}
          onBlur={() => setFocused(null)}
          style={[controlStyles.control, styles.input, styles.textarea, focused === 'description' && controlStyles.focus]}
          testID="description-input"
        />
      </Field>

      <Field label="Assignee" error={assigneeError} errorTestID="assignee-error" onLayout={onFieldLayout('assigneeId')} testID="field-assigneeId">
        <SelectControl
          label="Assignee"
          value={assignee ? assignee.userName : values.assigneeId ? 'Unknown member' : null}
          placeholder="Unassigned"
          leading={<Avatar name={assignee?.userName} unassigned={!values.assigneeId} />}
          invalid={!!errors.assigneeId}
          hint={assigneeError ?? undefined}
          disabled={submitting}
          onPress={() => setSheet('assignee')}
          testID="assignee-select"
        />
        {membersUnavailable ? (
          <Text style={styles.hint} testID="assignee-unavailable">
            {membersUnavailable}
          </Text>
        ) : null}
      </Field>

      <Field label="Priority" onLayout={onFieldLayout('priority')} testID="field-priority">
        <SelectControl
          label="Priority"
          value={values.priority ? PRIORITY_LABELS[values.priority] : null}
          placeholder="No priority"
          leading={values.priority ? <PriorityIcon level={values.priority} size={16} /> : undefined}
          disabled={submitting}
          onPress={() => setSheet('priority')}
          testID="priority-select"
        />
      </Field>

      <Field label="Due date" onLayout={onFieldLayout('dueDate')} testID="field-dueDate">
        <DueDateField value={values.dueDate} onChange={form.setDueDate} disabled={submitting} />
      </Field>

      <SelectionSheet
        visible={sheet === 'assignee'}
        title="Assignee"
        testID="assignee-sheet"
        selectedKey={values.assigneeId ?? UNASSIGNED}
        options={[
          { key: UNASSIGNED, label: 'Unassigned', leading: <Avatar unassigned /> },
          ...members.map((m) => ({ key: m.userId, label: m.userName, leading: <Avatar name={m.userName} /> })),
        ]}
        onSelect={(key) => {
          form.setAssigneeId(key === UNASSIGNED ? null : key);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <SelectionSheet
        visible={sheet === 'priority'}
        title="Priority"
        testID="priority-sheet"
        selectedKey={values.priority ?? NO_PRIORITY}
        options={[
          { key: NO_PRIORITY, label: 'No priority' },
          ...TASK_PRIORITIES.map((p) => ({ key: p, label: PRIORITY_LABELS[p], leading: <PriorityIcon level={p} size={16} /> })),
        ]}
        onSelect={(key) => {
          form.setPriority(key === NO_PRIORITY ? null : (key as TaskPriority));
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 20, paddingHorizontal: 16, paddingVertical: 20 },
  hint: { fontSize: 12, lineHeight: 16, color: colors.mutedForeground },
  input: { fontSize: 16, color: colors.foreground, paddingVertical: 10 },
  textarea: { minHeight: 104, borderRadius: radius.md },
});
