import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BLOCKED_EXPLANATION, blockedTitle, type IncompleteSubtask } from '../../domain/completeTask';
import type { Task } from '../../domain/models';
import { colors, radius, touchTarget } from '../../theme/tokens';
import { Button } from '../ui';

/**
 * What the parent screen shows after the backend refused to complete it: why, the children still
 * open (with their status when this board has them), a way into each, and Back to task.
 */
export function IncompleteSubtasks({
  subtasks,
  known,
  onOpen,
  onBack,
}: {
  subtasks: IncompleteSubtask[];
  /** The parent's subtasks as last read, for each one's column name. */
  known: Task[];
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  const remaining = subtasks.length;
  return (
    <View style={styles.root} testID="completion-blocked">
      <View style={styles.alert} accessibilityRole="alert" accessibilityLiveRegion="assertive">
        <Text style={styles.alertTitle} testID="completion-blocked-title">
          {blockedTitle(remaining)}
        </Text>
        <Text style={styles.alertText}>{BLOCKED_EXPLANATION}</Text>
      </View>

      <View style={styles.header}>
        <Text style={styles.heading} accessibilityRole="header">
          Incomplete subtasks
        </Text>
        <Text style={styles.count} testID="incomplete-count">
          {remaining} remaining
        </Text>
      </View>

      <View style={styles.children}>
        {subtasks.map((subtask) => {
          const column = known.find((t) => t.id.toLowerCase() === subtask.id.toLowerCase())?.columnName;
          return (
            <Pressable
              key={subtask.id}
              accessibilityRole="button"
              accessibilityLabel={`Open subtask ${subtask.readableId}, ${subtask.title}`}
              onPress={() => onOpen(subtask.id)}
              style={({ pressed }) => [styles.child, pressed && styles.childPressed]}
              testID={`incomplete-${subtask.id}`}
            >
              <Text style={styles.meta}>{column ? `${subtask.readableId} · ${column}` : subtask.readableId}</Text>
              <Text style={styles.title}>○ {subtask.title}</Text>
              <Text style={styles.link}>Open subtask →</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.hint}>Open each subtask above to finish the remaining work, then return to this parent.</Text>
      <Button label="Back to task" size="lg" block onPress={onBack} testID="back-to-task" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  alert: {
    padding: 14,
    gap: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.destructiveBorder,
    backgroundColor: colors.destructiveTint,
  },
  alertTitle: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.destructive },
  alertText: { fontSize: 14, lineHeight: 20, color: colors.destructive },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  heading: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.foreground },
  count: { fontSize: 13, lineHeight: 18, color: colors.mutedForeground },
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
  meta: { fontSize: 11, lineHeight: 16, color: colors.mutedForeground },
  title: { fontSize: 14, lineHeight: 20, color: colors.foreground },
  link: { fontSize: 12, lineHeight: 18, fontWeight: '500', color: colors.foreground, textDecorationLine: 'underline', marginTop: 2 },
  hint: { fontSize: 12, lineHeight: 16, color: colors.mutedForeground },
});
