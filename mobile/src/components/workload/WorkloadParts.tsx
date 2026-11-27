import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  LOADING_WORKLOAD,
  barFraction,
  openCountLabel,
  openTasksLabel,
  taskMeta,
  type MemberWorkload,
  type WorkloadTask,
} from '../../domain/workload';
import { colors, radius, touchTarget } from '../../theme/tokens';
import { Avatar, Button, Skeleton } from '../ui';

/** A grey note, e.g. “No open tasks in this project.” */
export function Note({ children, testID, live }: { children: string; testID?: string; live?: boolean }) {
  return (
    <View style={styles.note} accessibilityLiveRegion={live ? 'polite' : undefined} testID={testID}>
      <Text style={styles.noteText}>{children}</Text>
    </View>
  );
}

/** The red box of a failed read, with the reason. */
export function ErrorNote({ children, testID }: { children: string; testID?: string }) {
  return (
    <View style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="assertive" testID={testID}>
      <Text style={styles.errorText}>{children}</Text>
    </View>
  );
}

/** “Loading current assignments…” and grey rows: no count is shown before the backend answers. */
export function WorkloadLoading() {
  return (
    <View style={styles.list} testID="workload-loading" accessibilityLabel="Loading workload">
      <Note live>{LOADING_WORKLOAD}</Note>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} width="100%" height={64} borderRadius={radius.lg} />
      ))}
    </View>
  );
}

/**
 * A member's card: initials, name, “8 open” and a bar whose length is their share of the highest
 * count, so the busiest member fills it. The bar repeats the number, it adds no rating of its own.
 * Pressing the card opens the member's open tasks.
 */
export function MemberCard({
  member,
  max,
  showBar,
  onPress,
}: {
  member: MemberWorkload;
  max: number;
  showBar: boolean;
  onPress: () => void;
}) {
  const fraction = barFraction(member.openTaskCount, max);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${member.userName}, ${openTasksLabel(member.openTaskCount)}`}
      accessibilityHint="Opens their open tasks."
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      testID={`member-${member.userId}`}
    >
      <View style={styles.memberRow}>
        <Avatar name={member.userName} size={32} />
        <Text style={styles.memberName} numberOfLines={2}>
          {member.userName}
        </Text>
        <Text style={styles.count} testID={`member-count-${member.userId}`}>
          {showBar ? openCountLabel(member.openTaskCount) : ''}
        </Text>
      </View>
      {showBar ? (
        <View style={styles.track} importantForAccessibility="no-hide-descendants" testID={`member-bar-${member.userId}`}>
          <View style={[styles.bar, { width: `${Math.round(fraction * 100)}%` }]} />
        </View>
      ) : (
        <Text style={styles.cardText}>{openTasksLabel(member.openTaskCount)}</Text>
      )}
    </Pressable>
  );
}

/** A task of a workload list: its title and “TES-31 · To do · High”. Pressing it opens the task. */
export function WorkloadTaskRow({
  task,
  boardName,
  onPress,
}: {
  task: WorkloadTask;
  boardName?: string;
  onPress: () => void;
}) {
  const meta = taskMeta(task, boardName);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${task.title}, ${meta}`}
      accessibilityHint="Opens the task."
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      testID={`workload-task-${task.id}`}
    >
      <Text style={styles.taskTitle}>{task.title}</Text>
      <Text style={styles.cardText}>{meta}</Text>
    </Pressable>
  );
}

/** The red error box and Try again, when no counts could be loaded. */
export function WorkloadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.list}>
      <ErrorNote testID="workload-error">{message}</ErrorNote>
      <Button label="Try again" size="lg" block onPress={onRetry} testID="workload-retry" />
    </View>
  );
}

export const workloadStyles = StyleSheet.create({
  subtitle: { fontSize: 14, lineHeight: 20, color: colors.mutedForeground, marginTop: -8 },
  meta: { fontSize: 12, lineHeight: 16, color: colors.mutedForeground },
  list: { gap: 10 },
  groupTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.foreground },
  card: {
    minHeight: touchTarget,
    padding: 12,
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
  },
  cardText: { fontSize: 12, lineHeight: 18, color: colors.mutedForeground },
});

const styles = StyleSheet.create({
  ...workloadStyles,
  pressed: { backgroundColor: colors.muted },
  note: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.muted },
  noteText: { fontSize: 14, lineHeight: 20, color: colors.foreground },
  error: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.destructiveBorder,
    backgroundColor: colors.alertBackground,
  },
  errorText: { fontSize: 14, lineHeight: 20, color: colors.destructive },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32 },
  memberName: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '700', color: colors.foreground },
  count: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.foreground },
  track: { height: 6, marginTop: 10, borderRadius: 3, backgroundColor: colors.muted, overflow: 'hidden' },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  taskTitle: { fontSize: 15, lineHeight: 22, fontWeight: '700', color: colors.foreground },
});
