import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  PRIORITY_CHOICES,
  REORDER_PAUSED,
  moveHint,
  positionError,
  priorityLabel,
  type BacklogItem,
} from '../../domain/backlog';
import type { TaskPriority } from '../../domain/models';
import { colors, radius, touchTarget } from '../../theme/tokens';
import { controlStyles, FieldError, FieldLabel } from '../form/fields';
import { Icon } from '../icons';
import { Button } from '../ui';

/** The grey box naming the item being changed: “Review permissions / TES-32 · Position 2”. */
function ItemCard({ item, detail }: { item: BacklogItem; detail: string }) {
  return (
    <View style={styles.card} testID="selected-item">
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardText}>
        {item.readableId} · {detail}
      </Text>
    </View>
  );
}

/** A grey note in the list, e.g. “Reordering is paused while searching or filtering.” */
export function InfoBox({ children, testID }: { children: string; testID?: string }) {
  return (
    <View style={styles.info} testID={testID}>
      <Text style={styles.infoText}>{children}</Text>
    </View>
  );
}

/**
 * Item actions, as in the design: Move up, Move down, Move to position…, Change priority, Cancel.
 * Up is off for the first item and Down for the last. While a search or filter is on, the order
 * can't be changed, so only Change priority is offered.
 */
export function ItemActionsPanel({
  item,
  position,
  totalCount,
  canReorder,
  onMoveUp,
  onMoveDown,
  onMoveToPosition,
  onChangePriority,
  onCancel,
}: {
  item: BacklogItem;
  /** Its place in the full backlog; null while filtered, where the numbers are only the results'. */
  position: number | null;
  totalCount: number;
  canReorder: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveToPosition: () => void;
  onChangePriority: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.panel} testID="item-actions">
      <ItemCard item={item} detail={position ? `Position ${position}` : priorityLabel(item.priority)} />
      {canReorder && position ? (
        <>
          <Button label="Move up" size="lg" block disabled={position <= 1} onPress={onMoveUp} testID="action-move-up" />
          <Button
            label="Move down"
            variant="outline"
            size="lg"
            block
            disabled={position >= totalCount}
            onPress={onMoveDown}
            testID="action-move-down"
          />
          <Button
            label="Move to position…"
            variant="outline"
            size="lg"
            block
            disabled={totalCount < 2}
            onPress={onMoveToPosition}
            testID="action-move-to"
          />
        </>
      ) : (
        <InfoBox testID="reorder-paused-actions">{REORDER_PAUSED}</InfoBox>
      )}
      <Button
        label="Change priority"
        variant={canReorder ? 'outline' : 'default'}
        size="lg"
        block
        onPress={onChangePriority}
        testID="action-change-priority"
      />
      <Button label="Cancel" variant="outline" size="lg" block onPress={onCancel} testID="action-cancel" />
    </View>
  );
}

/**
 * Move to a global position: 1 to the backlog's item count. The hint names the item now at that
 * place when it's loaded. Out-of-range numbers are refused inline; nothing is sent until Move item.
 */
export function MoveToPositionPanel({
  item,
  position,
  totalCount,
  itemAt,
  onMove,
  onCancel,
}: {
  item: BacklogItem;
  position: number;
  totalCount: number;
  /** The loaded item at a 1-based place, if loaded. */
  itemAt: (position: number) => BacklogItem | undefined;
  onMove: (target: number) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const error = positionError(text, position, totalCount);
  const target = Number(text.trim());
  // Shown as soon as something invalid is typed; an empty field only once Move item is pressed.
  const showError = !!error && (submitted || text.trim() !== '');

  return (
    <View style={styles.panel} testID="move-to-position">
      <ItemCard item={item} detail={`Current position ${position} of ${totalCount}`} />
      <View style={styles.field}>
        <FieldLabel required>New position </FieldLabel>
        <TextInput
          value={text}
          onChangeText={(value) => {
            setText(value);
            setSubmitted(false);
          }}
          keyboardType="number-pad"
          inputMode="numeric"
          returnKeyType="done"
          maxLength={7}
          autoFocus
          accessibilityLabel={`New position, 1 to ${totalCount}`}
          style={[controlStyles.control, styles.input, showError ? controlStyles.invalid : null]}
          onSubmitEditing={() => (error ? setSubmitted(true) : onMove(target))}
          testID="position-input"
        />
        {showError ? <FieldError testID="position-error">{error}</FieldError> : null}
      </View>
      {!error ? (
        <InfoBox testID="position-hint">{moveHint(target, position, totalCount, itemAt(target))}</InfoBox>
      ) : null}
      <Button
        label="Move item"
        size="lg"
        block
        onPress={() => (error ? setSubmitted(true) : onMove(target))}
        testID="move-item"
      />
      <Button label="Cancel" variant="outline" size="lg" block onPress={onCancel} testID="move-cancel" />
    </View>
  );
}

/**
 * Choose one priority, as in the design's bottom sheet: the backend's values and No priority.
 * Apply priority saves; closing discards the draft. While saving, Apply can't be pressed again.
 * If the backend refuses, the draft stays and the reason is shown, so Apply can be tried again.
 */
export function PrioritySheet({
  item,
  saving,
  onApply,
  onClose,
}: {
  item: BacklogItem | null;
  saving: boolean;
  /** Resolves to null when saved, or to the reason it wasn't. */
  onApply: (priority: TaskPriority | null) => Promise<string | null>;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={() => {
        if (!saving) onClose();
      }}>
      {item ? <PrioritySheetContent key={item.id} item={item} saving={saving} onApply={onApply} onClose={onClose} bottom={insets.bottom} /> : null}
    </Modal>
  );
}

function PrioritySheetContent({
  item,
  saving,
  onApply,
  onClose,
  bottom,
}: {
  item: BacklogItem;
  saving: boolean;
  onApply: (priority: TaskPriority | null) => Promise<string | null>;
  onClose: () => void;
  bottom: number;
}) {
  const [draft, setDraft] = useState<TaskPriority | null>(item.priority);
  const [error, setError] = useState<string | null>(null);
  const unchanged = draft === item.priority;

  const apply = async () => {
    setError(null);
    const failure = await onApply(draft);
    if (failure) setError(failure);
  };

  return (
    <View style={styles.sheetRoot}>
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityLabel="Close"
        disabled={saving}
        onPress={onClose}
      />
      <View style={[styles.sheet, { paddingBottom: bottom + 16 }]} accessibilityViewIsModal testID="priority-sheet">
        <View style={styles.grabber} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle} accessibilityRole="header">
            Priority
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            accessibilityState={{ disabled: saving }}
            disabled={saving}
            onPress={onClose}
            hitSlop={8}
            style={styles.close}
            testID="priority-close"
          >
            <Icon name="x" size={18} color={saving ? colors.mutedForeground : colors.foreground} />
          </Pressable>
        </View>
        <Text style={styles.sheetSubtitle} numberOfLines={2}>
          {item.readableId} · {item.title}
        </Text>
        <ScrollView style={styles.options} contentContainerStyle={styles.optionsContent} accessibilityRole="radiogroup">
          {PRIORITY_CHOICES.map((choice) => {
            const checked = draft === choice;
            const label = priorityLabel(choice);
            return (
              <Pressable
                key={choice ?? 'NONE'}
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityState={{ checked, disabled: saving }}
                disabled={saving}
                onPress={() => {
                  setDraft(choice);
                  setError(null);
                }}
                style={({ pressed }) => [styles.option, checked && styles.optionChecked, pressed && styles.optionPressed]}
                testID={`priority-option-${choice ?? 'NONE'}`}
              >
                <Text style={styles.optionText}>{label}</Text>
                <View style={[styles.radio, checked && styles.radioChecked]}>
                  {checked ? <View style={styles.radioDot} /> : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        {error ? (
          <View style={styles.sheetError} accessibilityRole="alert" accessibilityLiveRegion="assertive" testID="priority-error">
            <Text style={styles.sheetErrorTitle}>Couldn’t update the priority.</Text>
            <Text style={styles.sheetErrorText}>{error}</Text>
          </View>
        ) : null}
        <Button
          label={saving ? 'Saving…' : error ? 'Try again' : 'Apply priority'}
          size="lg"
          block
          loading={saving}
          disabled={unchanged}
          onPress={() => void apply()}
          testID="apply-priority"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 12 },
  card: {
    padding: 12,
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
  },
  cardTitle: { fontSize: 15, lineHeight: 22, fontWeight: '700', color: colors.foreground },
  cardText: { fontSize: 12, lineHeight: 18, color: colors.mutedForeground },
  info: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.muted },
  infoText: { fontSize: 14, lineHeight: 20, color: colors.foreground },
  field: { gap: 8 },
  input: { fontSize: 16, color: colors.foreground, paddingVertical: 10 },
  sheetRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: colors.border },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 20, lineHeight: 28, fontWeight: '700', color: colors.foreground },
  close: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center', marginRight: -12 },
  sheetSubtitle: { fontSize: 12, lineHeight: 16, color: colors.mutedForeground, marginTop: -8 },
  options: { maxHeight: 360 },
  optionsContent: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  optionChecked: { borderColor: colors.foreground, backgroundColor: colors.muted },
  optionPressed: { backgroundColor: colors.muted },
  optionText: { flex: 1, fontSize: 16, lineHeight: 24, color: colors.foreground },
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
  sheetError: {
    padding: 12,
    gap: 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.destructiveBorder,
    backgroundColor: colors.alertBackground,
  },
  sheetErrorTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.destructive },
  sheetErrorText: { fontSize: 13, lineHeight: 18, color: colors.destructive },
});
