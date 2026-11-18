import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dateKeyToDate, formatFullDate, toDateKey } from '../../domain/format';
import { isValidDateKey } from '../../domain/editTask';
import { colors, radius, touchTarget } from '../../theme/tokens';
import { Button } from '../ui';

/**
 * A date box as in the Edit task design (“Nov 16, 2026”). Tapping it opens the platform's date
 * picker, which also offers Clear, because both dates are optional.
 */
export function DateField({
  label,
  value,
  onChange,
  invalid,
  disabled,
  testID,
}: {
  label: string;
  value: string | null;
  onChange: (dateKey: string | null) => void;
  invalid?: boolean;
  disabled?: boolean;
  testID: string;
}) {
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(new Date());
  const insets = useSafeAreaInsets();
  const readable = value && isValidDateKey(value) ? value : null;
  const current = readable ? dateKeyToDate(readable) : new Date();

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        neutralButton: { label: 'Clear' },
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(toDateKey(date));
          else if (event.type === 'neutralButtonPressed') onChange(null);
        },
      });
    } else {
      setIosDraft(current);
      setIosOpen(true);
    }
  };

  const shown = readable ? formatFullDate(readable) : value ? value : null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${shown ?? 'Not set'}`}
        accessibilityHint="Opens a date picker."
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={open}
        style={[styles.box, invalid && styles.invalid, disabled && styles.disabled]}
        testID={testID}
      >
        <Text style={[styles.value, !shown && styles.placeholder]} numberOfLines={1}>
          {shown ?? 'Pick a date'}
        </Text>
      </Pressable>

      {Platform.OS !== 'android' ? (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <View style={styles.backdrop}>
            <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close" onPress={() => setIosOpen(false)} />
            <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
              <Text style={styles.sheetTitle} accessibilityRole="header">
                {label}
              </Text>
              <DateTimePicker
                value={iosDraft}
                mode="date"
                display="inline"
                onChange={(_, date) => {
                  if (date) setIosDraft(date);
                }}
                testID={`${testID}-picker`}
              />
              <View style={styles.actions}>
                <Button
                  label="Clear"
                  variant="outline"
                  size="lg"
                  style={styles.action}
                  onPress={() => {
                    onChange(null);
                    setIosOpen(false);
                  }}
                  testID={`${testID}-clear`}
                />
                <Button
                  label="Done"
                  size="lg"
                  style={styles.action}
                  onPress={() => {
                    onChange(toDateKey(iosDraft));
                    setIosOpen(false);
                  }}
                  testID={`${testID}-done`}
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  invalid: { borderColor: colors.destructive },
  disabled: { opacity: 0.5 },
  value: { fontSize: 16, lineHeight: 24, color: colors.foreground },
  placeholder: { color: colors.mutedForeground },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, gap: 12 },
  sheetTitle: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: colors.foreground },
  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1 },
});
