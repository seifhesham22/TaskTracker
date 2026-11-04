import { StyleSheet, Text, View } from 'react-native';

import { formatDueDate, isOverdue, isoToDateKey } from '../../domain/format';
import { PRIORITY_LABELS, type ProjectMember, type Task } from '../../domain/models';
import { colors, radius } from '../../theme/tokens';
import { Avatar, Skeleton } from '../ui';
import { DueDateLabel, PriorityBadge } from './markers';

export function TaskCard({ task, members }: { task: Task; members: ProjectMember[] }) {
  const assignee = task.assigneeIds[0] ? members.find((m) => m.userId === task.assigneeIds[0]) : undefined;
  const assigneeName = assignee?.userName || task.assigneeNames?.[0];
  const hasMeta = !!(task.priority || task.dueDate || task.assigneeIds.length > 0);
  const accessibilityLabel = [
    task.title,
    task.description,
    task.priority && `Priority ${PRIORITY_LABELS[task.priority]}`,
    task.dueDate && `Due ${formatDueDate(isoToDateKey(task.dueDate))}`,
    assigneeName && `Assigned to ${assigneeName}`,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <View style={styles.card} testID={`task-card-${task.id}`} accessible accessibilityLabel={accessibilityLabel}>
      <Text style={styles.title} numberOfLines={3}>
        {task.title}
      </Text>
      {task.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {task.description}
        </Text>
      ) : null}
      {hasMeta ? (
        <View style={styles.meta}>
          {task.priority ? <PriorityBadge priority={task.priority} /> : null}
          {task.dueDate ? <DueDateLabel dueDate={task.dueDate} overdue={isOverdue(task.dueDate, task.status)} /> : null}
          <View style={styles.spacer} />
          {task.assigneeIds.length > 0 ? <Avatar name={assigneeName || '?'} /> : null}
        </View>
      ) : null}
    </View>
  );
}

export function TaskCardSkeleton() {
  return (
    <View style={[styles.card, styles.skeletonCard]}>
      <Skeleton width="100%" height={16} />
      <Skeleton width={200} height={16} />
      <View style={styles.meta}>
        <Skeleton width={64} height={20} borderRadius={6} />
        <Skeleton width={44} height={16} />
        <View style={styles.spacer} />
        <Skeleton width={24} height={24} borderRadius={12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  skeletonCard: { shadowOpacity: 0, elevation: 0 },
  title: { fontSize: 16, lineHeight: 24, fontWeight: '500', color: colors.foreground },
  description: { fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spacer: { flex: 1 },
});
