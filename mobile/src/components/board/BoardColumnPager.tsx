import { useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';

import type { BoardColumn, ProjectMember, Task } from '../../domain/models';
import { colors } from '../../theme/tokens';
import { Button } from '../ui';
import { TaskCard, TaskCardSkeleton } from './TaskCard';

/** One page per column. Swiping and tapping a tab do the same thing; each page scrolls vertically. */
export function BoardColumnPager({
  columns,
  tasksByColumn,
  members,
  activeIndex,
  onIndexChange,
  onAddTask,
  refreshing,
  onRefresh,
}: {
  columns: BoardColumn[];
  tasksByColumn: Record<string, Task[]>;
  members: ProjectMember[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  onAddTask: (columnId: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollViewInstance>(null);
  // Only the first page shown; later changes scroll in the effect below.
  const [initialIndex] = useState(activeIndex);

  useEffect(() => {
    scrollRef.current?.scrollTo({ x: activeIndex * width, animated: true });
  }, [activeIndex, width]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      contentOffset={{ x: initialIndex * width, y: 0 }}
      onMomentumScrollEnd={(e) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / width);
        if (index !== activeIndex && index >= 0 && index < columns.length) onIndexChange(index);
      }}
      style={styles.pager}
      testID="board-column-pager"
    >
      {columns.map((column) => (
        <ScrollView
          key={column.id}
          style={{ width }}
          contentContainerStyle={styles.page}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          testID={`column-page-${column.id}`}
        >
          {(tasksByColumn[column.id] ?? []).map((task) => (
            <TaskCard key={task.id} task={task} members={members} />
          ))}
          <Button
            variant="ghost"
            size="lg"
            icon="plus"
            label="Add task"
            alignStart
            textColor={colors.mutedForeground}
            accessibilityLabel={`Add task to ${column.name}`}
            onPress={() => onAddTask(column.id)}
          />
        </ScrollView>
      ))}
    </ScrollView>
  );
}

export function BoardSkeleton() {
  return (
    <View style={styles.page} aria-busy accessibilityLabel="Loading board">
      <TaskCardSkeleton />
      <TaskCardSkeleton />
      <TaskCardSkeleton />
    </View>
  );
}

const styles = StyleSheet.create({
  pager: { flex: 1 },
  // Bottom padding keeps the last card clear of the floating "New task" button.
  page: { paddingHorizontal: 16, paddingBottom: 120, gap: 12 },
});
