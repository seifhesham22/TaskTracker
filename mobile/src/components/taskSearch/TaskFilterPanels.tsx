import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ColumnCategory, ProjectMember } from '../../domain/models';
import { ROLE_LABELS } from '../../domain/members';
import { TASK_PRIORITIES } from '../../domain/models';
import {
  assigneeLabel,
  matchMembers,
  priorityChoiceLabel,
  statusLabel,
  type AssigneeChoice,
  type PriorityChoice,
  type TaskFilters,
} from '../../domain/taskFilters';
import { colors, radius } from '../../theme/tokens';
import { controlStyles, Field, SelectControl, SelectionSheet } from '../form/fields';
import { Avatar, Button } from '../ui';

const PRIORITY_CHOICES: PriorityChoice[] = ['any', null, ...TASK_PRIORITIES];
const priorityKey = (p: PriorityChoice) => (p === null ? 'NONE' : p === 'any' ? 'ANY' : p);

/**
 * Filter tasks, as in the design: one value per category, kept as a draft. Apply filters
 * commits the draft; Reset filters clears the draft only; Cancel keeps the filters in force.
 */
export function FilterTasksPanel({
  draft,
  onChange,
  statuses,
  members,
  onPickAssignee,
  onApply,
  onCancel,
}: {
  draft: TaskFilters;
  onChange: (next: TaskFilters) => void;
  statuses: readonly ColumnCategory[];
  members: readonly ProjectMember[];
  onPickAssignee: () => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const [sheet, setSheet] = useState<'status' | 'priority' | null>(null);
  return (
    <View style={styles.panel} testID="filter-tasks">
      <Field label="Status">
        <SelectControl
          label="Status"
          value={statusLabel(draft.status)}
          placeholder="Any status"
          onPress={() => setSheet('status')}
          testID="filter-status"
        />
      </Field>
      <Field label="Assignee">
        <SelectControl
          label="Assignee"
          value={assigneeLabel(draft.assignee, members)}
          placeholder="Anyone"
          onPress={onPickAssignee}
          testID="filter-assignee"
        />
      </Field>
      <Field label="Priority">
        <SelectControl
          label="Priority"
          value={priorityChoiceLabel(draft.priority)}
          placeholder="Any priority"
          onPress={() => setSheet('priority')}
          testID="filter-priority"
        />
      </Field>
      <Button label="Apply filters" size="lg" block onPress={onApply} testID="apply-filters" />
      <Button
        label="Reset filters"
        variant="outline"
        size="lg"
        block
        onPress={() => onChange({ status: null, assignee: { kind: 'anyone' }, priority: 'any' })}
        testID="reset-filters"
      />
      <Button label="Cancel" variant="outline" size="lg" block onPress={onCancel} testID="cancel-filters" />

      <SelectionSheet
        visible={sheet === 'status'}
        title="Status"
        options={[{ key: 'ANY', label: 'Any status' }, ...statuses.map((s) => ({ key: s, label: statusLabel(s) }))]}
        selectedKey={draft.status ?? 'ANY'}
        onSelect={(key) => {
          onChange({ ...draft, status: key === 'ANY' ? null : (key as ColumnCategory) });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
        testID="status-sheet"
      />
      <SelectionSheet
        visible={sheet === 'priority'}
        title="Priority"
        options={PRIORITY_CHOICES.map((p) => ({ key: priorityKey(p), label: priorityChoiceLabel(p) }))}
        selectedKey={priorityKey(draft.priority)}
        onSelect={(key) => {
          // An index, not `find`: the chosen value can itself be null (No priority).
          const index = PRIORITY_CHOICES.findIndex((p) => priorityKey(p) === key);
          onChange({ ...draft, priority: index >= 0 ? PRIORITY_CHOICES[index] : 'any' });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
        testID="priority-sheet"
      />
    </View>
  );
}

const sameChoice = (a: AssigneeChoice, b: AssigneeChoice) =>
  a.kind === b.kind && (a.kind !== 'member' || (b.kind === 'member' && a.userId === b.userId));

/**
 * The assignee picker: a searchable single-select list of the project's members, with Anyone
 * (no assignee filter) and Unassigned (tasks with no assignee). Members are matched by user id.
 */
export function AssigneePicker({
  value,
  members,
  membersUnavailable,
  onApply,
  onCancel,
}: {
  value: AssigneeChoice;
  members: readonly ProjectMember[];
  membersUnavailable?: string;
  onApply: (choice: AssigneeChoice) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [choice, setChoice] = useState<AssigneeChoice>(value);
  const shown = matchMembers(members, text);

  const row = (key: string, option: AssigneeChoice, title: string, detail: string, avatar: React.ReactNode) => {
    const checked = sameChoice(choice, option);
    return (
      <Pressable
        key={key}
        accessibilityRole="radio"
        accessibilityLabel={`${title}, ${detail}`}
        accessibilityState={{ checked }}
        onPress={() => setChoice(option)}
        style={({ pressed }) => [styles.option, checked && styles.optionChecked, pressed && styles.optionPressed]}
        testID={`assignee-option-${key}`}
      >
        {avatar}
        <View style={styles.optionText}>
          <Text style={styles.optionTitle} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.optionDetail}>{detail}</Text>
        </View>
        <View style={[styles.radio, checked && styles.radioChecked]}>{checked ? <View style={styles.radioDot} /> : null}</View>
      </Pressable>
    );
  };
  const dash = (
    <View style={styles.dash}>
      <Text style={styles.dashText}>–</Text>
    </View>
  );

  return (
    <View style={styles.panel} testID="assignee-picker">
      <Field label="Find an assignee">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Search project members…"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search project members"
          style={[controlStyles.control, styles.input]}
          testID="assignee-search"
        />
      </Field>
      {membersUnavailable ? <Text style={styles.optionDetail}>{membersUnavailable}</Text> : null}
      {row('anyone', { kind: 'anyone' }, 'Anyone', 'All assignees', dash)}
      {row('unassigned', { kind: 'unassigned' }, 'Unassigned', 'Tasks without an assignee', dash)}
      {shown.map((m) =>
        row(
          m.userId,
          { kind: 'member', userId: m.userId },
          m.userName,
          m.role && ROLE_LABELS[m.role] ? `Project member · ${ROLE_LABELS[m.role]}` : 'Project member',
          <Avatar name={m.userName} size={32} />,
        ),
      )}
      {text.trim() && shown.length === 0 ? (
        <Text style={styles.optionDetail} testID="assignee-no-match">
          No project members match “{text.trim()}”.
        </Text>
      ) : null}
      <Button label="Apply assignee" size="lg" block onPress={() => onApply(choice)} testID="apply-assignee" />
      <Button label="Cancel" variant="outline" size="lg" block onPress={onCancel} testID="cancel-assignee" />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 12 },
  input: { fontSize: 16, color: colors.foreground, paddingVertical: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  optionChecked: { borderColor: colors.foreground, backgroundColor: colors.muted },
  optionPressed: { backgroundColor: colors.muted },
  optionText: { flex: 1, minWidth: 0 },
  optionTitle: { fontSize: 15, lineHeight: 22, fontWeight: '700', color: colors.foreground },
  optionDetail: { fontSize: 12, lineHeight: 18, color: colors.mutedForeground },
  dash: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.muted },
  dashText: { fontSize: 14, color: colors.mutedForeground },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.foreground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioChecked: { borderColor: colors.foreground },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.foreground },
});
