import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MUST_HAPPEN_BEFORE, countLabel } from '../../domain/dependencies';
import type { Task, TaskLink } from '../../domain/models';
import { colors, radius, touchTarget } from '../../theme/tokens';

type Named = Pick<TaskLink, 'readableId' | 'title'>;

/**
 * “TES-18 · Approve scope / ↓ must happen before / TES-24 · Prepare launch”: always the task that
 * goes first on top, so the direction reads the same from either task.
 */
export function RelationBox({ first, then, testID }: { first: Named; then: Named; testID?: string }) {
  return (
    <View
      style={styles.relation}
      accessible
      accessibilityLabel={`${first.readableId} ${first.title} ${MUST_HAPPEN_BEFORE} ${then.readableId} ${then.title}`}
      testID={testID}
    >
      <Text style={styles.relationTask} numberOfLines={2}>
        {first.readableId} · {first.title}
      </Text>
      <Text style={styles.relationArrow}>↓ {MUST_HAPPEN_BEFORE}</Text>
      <Text style={styles.relationTask} numberOfLines={2}>
        {then.readableId} · {then.title}
      </Text>
    </View>
  );
}

/** A task as a card: “TES-18 · In progress”, then its title. */
export function LinkCard({
  link,
  onPress,
  selected,
  disabled,
  note,
  hint,
  testID,
}: {
  link: TaskLink;
  onPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  note?: string;
  hint?: string;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[link.readableId, link.columnName, link.title, note].filter(Boolean).join(', ')}
      accessibilityHint={hint}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        disabled && styles.cardDisabled,
        pressed && styles.cardPressed,
      ]}
      testID={testID}
    >
      <Text style={styles.cardMeta}>
        {link.readableId} · {link.columnName}
        {note ? ` · ${note}` : ''}
      </Text>
      <Text style={styles.cardTitle}>{link.title}</Text>
    </Pressable>
  );
}

export function CountPill({ children, testID }: { children: string; testID?: string }) {
  return (
    <View style={styles.pill} testID={testID}>
      <Text style={styles.pillText}>{children}</Text>
    </View>
  );
}

/**
 * The task's dependencies both ways, as the backend returns them: “Blocked by” (tasks that must
 * happen first) and “Blocks” (tasks waiting for it). Each row opens the other task.
 */
export function DependencyList({ task, onOpen }: { task: Task; onOpen: (link: TaskLink) => void }) {
  const blockedBy = task.blockedBy ?? [];
  const blocks = task.blocks ?? [];
  if (blockedBy.length === 0 && blocks.length === 0) {
    return (
      <Text style={styles.empty} testID="no-dependencies">
        No dependencies yet. Add one to show which task must happen first.
      </Text>
    );
  }
  return (
    <View style={styles.list}>
      {blockedBy.length > 0 ? (
        <View style={styles.group} testID="blocked-by">
          <CountPill>{countLabel('Blocked by', blockedBy.length)}</CountPill>
          {blockedBy.map((link) => (
            <View key={link.id} style={styles.item}>
              <LinkCard link={link} onPress={() => onOpen(link)} hint="Opens the task." testID={`dependency-${link.id}`} />
              <RelationBox first={link} then={task} testID={`relation-${link.id}`} />
            </View>
          ))}
        </View>
      ) : null}
      {blocks.length > 0 ? (
        <View style={styles.group} testID="blocks">
          <CountPill>{countLabel('Blocks', blocks.length)}</CountPill>
          {blocks.map((link) => (
            <View key={link.id} style={styles.item}>
              <LinkCard link={link} onPress={() => onOpen(link)} hint="Opens the task." testID={`dependency-${link.id}`} />
              <RelationBox first={task} then={link} testID={`relation-${link.id}`} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  relation: { padding: 12, gap: 4, borderRadius: radius.md, backgroundColor: colors.muted },
  relationTask: { fontSize: 14, lineHeight: 20, color: colors.foreground },
  relationArrow: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.foreground },
  card: {
    minHeight: touchTarget + 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
  },
  cardSelected: { borderColor: colors.foreground, borderWidth: 2 },
  cardDisabled: { opacity: 0.5 },
  cardPressed: { backgroundColor: colors.muted },
  cardMeta: { fontSize: 11, lineHeight: 16, color: colors.mutedForeground },
  cardTitle: { fontSize: 14, lineHeight: 20, color: colors.foreground },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  pillText: { fontSize: 14, lineHeight: 20, color: colors.foreground },
  list: { gap: 20 },
  group: { gap: 10 },
  item: { gap: 8 },
  empty: { fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
});
