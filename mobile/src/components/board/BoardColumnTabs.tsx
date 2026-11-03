import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';

import type { BoardColumn } from '../../domain/models';
import { colors, radius } from '../../theme/tokens';
import { Skeleton } from '../ui';
import { StatusIcon } from './markers';

/** One BoardColumnTab per column (StatusIcon + name + count); the active tab is kept in view. */
export function BoardColumnTabs({
  columns,
  counts,
  activeIndex,
  onSelect,
}: {
  columns: BoardColumn[];
  counts: Record<string, number>;
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const tabX = useRef<number[]>([]);

  useEffect(() => {
    const x = tabX.current[activeIndex];
    if (x !== undefined) scrollRef.current?.scrollTo({ x: Math.max(0, x - 24), animated: true });
  }, [activeIndex]);

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        accessibilityRole="tablist"
      >
        {columns.map((column, index) => {
          const active = index === activeIndex;
          const count = counts[column.id] ?? 0;
          return (
            <Pressable
              key={column.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${column.name}, ${count} ${count === 1 ? 'task' : 'tasks'}`}
              onPress={() => onSelect(index)}
              onLayout={(e) => {
                tabX.current[index] = e.nativeEvent.layout.x;
              }}
              hitSlop={4}
              style={[styles.tab, active && styles.tabActive]}
              testID={`column-tab-${column.id}`}
            >
              <StatusIcon category={column.category} color={column.color} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{column.name}</Text>
              <Text style={styles.count}>{count}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function BoardColumnTabsSkeleton() {
  return (
    <View style={[styles.wrap, styles.skeletonRow]}>
      {[84, 70, 104, 70].map((w, i) => (
        <Skeleton key={i} width={w} height={24} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 42, marginTop: 4, marginHorizontal: 16, marginBottom: 12, borderRadius: radius.lg, backgroundColor: colors.muted, overflow: 'hidden' },
  list: { padding: 3, gap: 2 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: radius.md },
  tabActive: {
    backgroundColor: colors.background,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tabText: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.mutedForeground },
  tabTextActive: { color: colors.foreground },
  count: { fontSize: 12, lineHeight: 16, color: colors.mutedForeground },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
});
