import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dateKeyToDate, formatFullDate, toDateKey } from '../../domain/format';
import { colors, touchTarget } from '../../theme/tokens';
import { Icon } from '../icons';
import { Button } from '../ui';
import { SelectControl } from './fields';

export function DueDateField({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (dateKey: string | null) => void;
  disabled?: boolean;
}) {
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(new Date());
  const insets = useSafeAreaInsets();
  const current = value ? dateKeyToDate(value) : new Date();

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(toDateKey(date));
        },
      });
    } else {
      setIosDraft(current);
      setIosOpen(true);
    }
  };

  return (
    <>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <SelectControl
            label="Due date"
            value={value ? formatFullDate(value) : null}
            placeholder="Pick a date"
            leading={<Icon name="calendar" color={value ? colors.foreground : colors.mutedForeground} size={16} />}
            chevron={false}
            disabled={disabled}
            onPress={open}
            testID="due-date-select"
          />
        </View>
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear due date"
            disabled={disabled}
            onPress={() => onChange(null)}
            style={styles.clear}
            testID="due-date-clear"
          >
            <Icon name="x" size={18} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      {Platform.OS !== 'android' ? (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <View style={styles.backdrop}>
            <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close" onPress={() => setIosOpen(false)} />
            <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
              <DateTimePicker
                value={iosDraft}
                mode="date"
                display="inline"
                onChange={(_, date) => {
                  if (date) setIosDraft(date);
                }}
                testID="due-date-picker"
              />
              <Button
                label="Done"
                size="lg"
                block
                onPress={() => {
                  onChange(toDateKey(iosDraft));
                  setIosOpen(false);
                }}
                testID="due-date-done"
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clear: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, gap: 12 },
});
