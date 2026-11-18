import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ColumnCategory, Task } from '../../domain/models';
import { isDone } from '../../domain/subtask';
import { colors, radius, touchTarget } from '../../theme/tokens';

const STATUS_MARK: Record<ColumnCategory, string> = {
  BACKLOG: '○',
  TO_DO: '○',
  IN_PROGRESS: '◐',
  DONE: '✓',
  CANCELLED: '○',
};

/** The task's status as a small chip, e.g. “◐ In progress”, named after its column. */
export function StatusChip({ task }: { task: Task }) {
  return (
    <View style={styles.chip} accessibilityLabel={`Status: ${task.columnName}`} testID="task-status">
      <Text style={styles.chipText}>
        {STATUS_MARK[task.status]} {task.columnName}
      </Text>
    </View>
  );
}

/**
 * “Subtasks  1 / 3 done”, then each subtask indented under the parent, labelled with its key and
 * status. Tapping one opens it.
 */
export function SubtaskList({ subtasks, onOpen }: { subtasks: Task[]; onOpen: (task: Task) => void }) {
  const done = subtasks.filter(isDone).length;
  return (
    <View style={styles.section} testID="subtasks">
      <View style={styles.header}>
        <Text style={styles.heading} accessibilityRole="header">
          Subtasks
        </Text>
        <Text style={styles.progress} testID="subtask-progress" accessibilityLabel={`${done} of ${subtasks.length} done`}>
          {done} / {subtasks.length} done
        </Text>
      </View>
      {subtasks.length === 0 ? (
        <Text style={styles.empty}>No subtasks yet.</Text>
      ) : (
        <View style={styles.children}>
          {subtasks.map((subtask) => (
            <Pressable
              key={subtask.id}
              accessibilityRole="button"
              accessibilityLabel={`${subtask.readableId}, ${subtask.columnName}, ${subtask.title}`}
              accessibilityHint="Opens the subtask."
              onPress={() => onOpen(subtask)}
              style={({ pressed }) => [styles.child, pressed && styles.childPressed]}
              testID={`subtask-${subtask.id}`}
            >
              <Text style={styles.childMeta}>
                {subtask.readableId} · {subtask.columnName}
              </Text>
              <Text style={styles.childTitle}>
                {isDone(subtask) ? '✓' : '○'} {subtask.title}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  chipText: { fontSize: 12, lineHeight: 18, fontWeight: '500', color: colors.foreground },
  section: { gap: 10 },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  heading: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.foreground },
  progress: { fontSize: 13, lineHeight: 18, color: colors.mutedForeground },
  empty: { fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
  // The line on the left and the indent show that these belong to the task above.
  children: { marginLeft: 6, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.border, gap: 8 },
  child: {
    minHeight: touchTarget + 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    gap: 2,
  },
  childPressed: { backgroundColor: colors.muted },
  childMeta: { fontSize: 11, lineHeight: 16, color: colors.mutedForeground },
  childTitle: { fontSize: 14, lineHeight: 20, color: colors.foreground },
});
