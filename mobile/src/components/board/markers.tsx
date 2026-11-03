/**
 * StatusIcon, PriorityIcon, PriorityBadge and DueDateLabel from the design (same SVG shapes as the
 * handoff). Priority never relies on colour alone: 1/2/3 bars, a "!" square for Critical, and the
 * label is always shown.
 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { formatDueDate, isoToDateKey } from '../../domain/format';
import { PRIORITY_LABELS, type ColumnCategory, type TaskPriority } from '../../domain/models';
import { colors, radius } from '../../theme/tokens';
import { Icon } from '../icons';

const BACKLOG_ARCS = [
  'M10.1 2.182a10 10 0 0 1 3.8 0',
  'M13.9 21.818a10 10 0 0 1-3.8 0',
  'M17.609 3.721a10 10 0 0 1 2.69 2.7',
  'M2.182 13.9a10 10 0 0 1 0-3.8',
  'M20.279 17.609a10 10 0 0 1-2.7 2.69',
  'M21.818 10.1a10 10 0 0 1 0 3.8',
  'M3.721 6.391a10 10 0 0 1 2.7-2.69',
  'M6.391 20.279a10 10 0 0 1-2.69-2.7',
];

/** Shape from the column category, tint from the column colour. */
export function StatusIcon({ category, color, size = 16 }: { category: ColumnCategory; color?: string; size?: number }) {
  const tint = color || colors.status[category];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={tint} strokeWidth={2} strokeLinecap="round" aria-hidden>
      {category === 'BACKLOG' ? BACKLOG_ARCS.map((d) => <Path key={d} d={d} />) : null}
      {category === 'TO_DO' ? <Circle cx="12" cy="12" r="10" /> : null}
      {category === 'IN_PROGRESS' ? (
        <>
          <Circle cx="12" cy="12" r="10" />
          <Path d="M12 6a6 6 0 0 1 0 12z" fill={tint} stroke="none" />
        </>
      ) : null}
      {category === 'DONE' ? (
        <>
          <Circle cx="12" cy="12" r="10" fill={tint} />
          <Path d="m8 12 3 3 5-5" stroke="#FFFFFF" />
        </>
      ) : null}
      {category === 'CANCELLED' ? (
        <>
          <Circle cx="12" cy="12" r="10" />
          <Path d="m15 9-6 6" />
          <Path d="m9 9 6 6" />
        </>
      ) : null}
    </Svg>
  );
}

/** `onBadge`: drawn inside the solid red Critical badge, so the "!" square is inverted. */
export function PriorityIcon({ level, size = 14, onBadge }: { level: TaskPriority; size?: number; onBadge?: boolean }) {
  if (level === 'CRITICAL') {
    const red = colors.priority.CRITICAL.bg;
    const square = onBadge ? colors.priority.CRITICAL.fg : red;
    const mark = onBadge ? red : colors.priority.CRITICAL.fg;
    return (
      <Svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
        <Rect x="1" y="1" width="14" height="14" rx="3.5" fill={square} />
        <Rect x="7" y="3.75" width="2" height="5" rx="1" fill={mark} />
        <Circle cx="8" cy="11.6" r="1.15" fill={mark} />
      </Svg>
    );
  }
  const fg = colors.priority[level].fg;
  const filled = { LOW: 1, MEDIUM: 2, HIGH: 3 }[level];
  const bars: [number, number, number][] = [
    [1.5, 10, 4.5],
    [6.5, 6, 8.5],
    [11.5, 1.5, 13],
  ];
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      {bars.map(([x, y, h], i) => (
        <Rect key={x} x={x} y={y} width="3" height={h} rx="1" fill={fg} opacity={i < filled ? 1 : 0.25} />
      ))}
    </Svg>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const c = colors.priority[priority];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }]} accessibilityLabel={`Priority ${PRIORITY_LABELS[priority]}`}>
      <PriorityIcon level={priority} onBadge />
      <Text style={[styles.badgeText, { color: c.fg }]}>{PRIORITY_LABELS[priority]}</Text>
    </View>
  );
}

export function DueDateLabel({ dueDate, overdue }: { dueDate: string; overdue: boolean }) {
  const label = formatDueDate(isoToDateKey(dueDate));
  const color = overdue ? colors.destructive : colors.mutedForeground;
  return (
    <View style={styles.due}>
      <Icon name={overdue ? 'triangle-alert' : 'calendar'} size={14} color={color} />
      <Text style={[styles.dueText, { color }]}>{overdue ? `Overdue · ${label}` : label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingLeft: 6,
    paddingRight: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  badgeText: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  due: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dueText: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
});
