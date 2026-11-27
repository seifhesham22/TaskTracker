import { useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';

import { dropIndex, estimateLabel, priorityLabel, type BacklogItem, type RowLayout } from '../../domain/backlog';
import { colors, radius, touchTarget } from '../../theme/tokens';
import { Icon } from '../icons';

/** How far a press on the handle may move and still count as a tap (selecting the item). */
const TAP_SLOP = 6;

/**
 * The backlog's rows, numbered in the backend's order. For a backlog manager on the unfiltered
 * list, each row has a drag handle: dragging it moves the item among the loaded rows, a tap
 * selects the item for Item actions, and screen readers get Move up / Move down actions on it.
 * A long-press on a row also selects it (also while filtered, for its priority).
 */
export function BacklogRows({
  items,
  totalCount,
  canSelect,
  canDrag,
  disabled,
  selectedId,
  onOpen,
  onSelect,
  onMove,
  onDragChange,
}: {
  items: BacklogItem[];
  /** Every item of the backlog: the last one can't move down. */
  totalCount: number;
  /** A backlog manager: rows can be selected for Item actions. */
  canSelect: boolean;
  /** Reordering is possible: a manager, on the unfiltered list. */
  canDrag: boolean;
  /** A change is being saved. */
  disabled: boolean;
  selectedId: string | null;
  onOpen: (item: BacklogItem) => void;
  onSelect: (item: BacklogItem) => void;
  /** Moves the item to this 1-based place in the backlog. */
  onMove: (item: BacklogItem, position: number) => void;
  onDragChange: (dragging: boolean) => void;
}) {
  const layouts = useRef(new Map<string, { y: number; height: number }>());
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const ordered = (): RowLayout[] =>
    items.flatMap((item) => {
      const layout = layouts.current.get(item.id);
      return layout ? [{ id: item.id, ...layout }] : [];
    });

  return (
    <View style={styles.list} testID="backlog-rows">
      {items.map((item, index) => (
        <BacklogRow
          key={item.id}
          item={item}
          position={index + 1}
          isLast={index + 1 >= totalCount}
          canSelect={canSelect}
          canDrag={canDrag}
          disabled={disabled}
          selected={selectedId === item.id}
          dragging={draggingId === item.id}
          onLayout={(event) => {
            const { y, height } = event.nativeEvent.layout;
            layouts.current.set(item.id, { y, height });
          }}
          onOpen={() => onOpen(item)}
          onSelect={() => onSelect(item)}
          onMove={(position) => onMove(item, position)}
          onDragStart={() => {
            setDraggingId(item.id);
            onDragChange(true);
          }}
          onDragEnd={(dy) => {
            setDraggingId(null);
            onDragChange(false);
            if (dy === null) return;
            const to = dropIndex(ordered(), item.id, dy);
            if (to >= 0 && to !== index) onMove(item, to + 1);
          }}
        />
      ))}
    </View>
  );
}

function BacklogRow({
  item,
  position,
  isLast,
  canSelect,
  canDrag,
  disabled,
  selected,
  dragging,
  onLayout,
  onOpen,
  onSelect,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  item: BacklogItem;
  position: number;
  isLast: boolean;
  canSelect: boolean;
  canDrag: boolean;
  disabled: boolean;
  selected: boolean;
  dragging: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
  onOpen: () => void;
  onSelect: () => void;
  onMove: (position: number) => void;
  onDragStart: () => void;
  /** How far it was dragged, or null for a tap or a cancelled drag. */
  onDragEnd: (dy: number | null) => void;
}) {
  const [translate] = useState(() => new Animated.Value(0));
  // Where the finger went down on the handle; null when no drag is under way.
  const [startY, setStartY] = useState<number | null>(null);

  const release = (pageY: number | null) => {
    const dy = startY === null || pageY === null ? 0 : pageY - startY;
    setStartY(null);
    translate.setValue(0);
    if (pageY === null) onDragEnd(null);
    else if (Math.abs(dy) < TAP_SLOP) {
      onDragEnd(null);
      onSelect();
    } else onDragEnd(dy);
  };

  // The handle's own touch responder: it keeps the touch once it has it, so the list doesn't scroll.
  const handleResponder = {
    onStartShouldSetResponder: () => !disabled,
    onMoveShouldSetResponder: () => !disabled,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (event: GestureResponderEvent) => {
      setStartY(event.nativeEvent.pageY);
      translate.setValue(0);
      onDragStart();
    },
    onResponderMove: (event: GestureResponderEvent) => {
      if (startY !== null) translate.setValue(event.nativeEvent.pageY - startY);
    },
    onResponderRelease: (event: GestureResponderEvent) => release(event.nativeEvent.pageY),
    onResponderTerminate: () => release(null),
  };

  const summary = `${position}, ${item.readableId}, ${item.title}, ${item.columnName}, ${priorityLabel(item.priority)}, ${estimateLabel(item.storyPoints)}`;

  const handleActions = [
    { name: 'activate', label: `Select ${item.readableId} for item actions` },
    ...(position > 1 ? [{ name: 'moveUp', label: 'Move up' }] : []),
    ...(!isLast ? [{ name: 'moveDown', label: 'Move down' }] : []),
  ];
  const onHandleAction = (event: AccessibilityActionEvent) => {
    if (disabled) return;
    const action = event.nativeEvent.actionName;
    if (action === 'activate') onSelect();
    else if (action === 'moveUp' && position > 1) onMove(position - 1);
    else if (action === 'moveDown' && !isLast) onMove(position + 1);
  };

  return (
    <Animated.View
      onLayout={onLayout}
      testID={`backlog-row-${item.id}`}
      style={[dragging && styles.dragging, { transform: [{ translateY: dragging ? translate : 0 }] }]}
    >
      <View style={[styles.row, selected && styles.rowSelected, disabled && styles.rowDisabled]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={summary}
          accessibilityHint="Opens the task."
          accessibilityState={{ selected }}
          accessibilityActions={canSelect ? [{ name: 'longpress', label: 'Select for item actions' }] : undefined}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'longpress' && canSelect && !disabled) onSelect();
          }}
          onPress={onOpen}
          onLongPress={canSelect && !disabled ? onSelect : undefined}
          style={({ pressed }) => [styles.rowBody, pressed && styles.rowPressed]}
          testID={`backlog-item-${item.id}`}
        >
          <Text style={styles.rowKey}>
            {position} · {item.readableId}
          </Text>
          <Text style={styles.rowTitle}>{item.title}</Text>
          <Text style={styles.rowText}>
            {item.columnName} · {priorityLabel(item.priority)}
          </Text>
          <Text style={styles.rowText}>{estimateLabel(item.storyPoints)}</Text>
        </Pressable>
        {canDrag ? (
          <View
            {...handleResponder}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={`Reorder ${item.readableId}, position ${position}`}
            accessibilityHint="Press and hold, then drag to move it. Double tap to select it for item actions."
            accessibilityState={{ disabled, selected }}
            accessibilityActions={handleActions}
            onAccessibilityAction={onHandleAction}
            style={styles.handle}
            hitSlop={4}
            testID={`backlog-handle-${item.id}`}
          >
            <Icon name="grip-vertical" size={20} color={disabled ? colors.ring : colors.mutedForeground} />
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  rowSelected: { borderColor: colors.primary, borderWidth: 2 },
  rowDisabled: { opacity: 0.6 },
  dragging: {
    zIndex: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  rowBody: { flex: 1, minHeight: touchTarget, padding: 12, gap: 2 },
  rowPressed: { backgroundColor: colors.muted },
  rowKey: { fontSize: 11, lineHeight: 16, color: colors.mutedForeground },
  rowTitle: { fontSize: 15, lineHeight: 22, fontWeight: '700', color: colors.foreground },
  rowText: { fontSize: 12, lineHeight: 18, color: colors.mutedForeground },
  handle: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
