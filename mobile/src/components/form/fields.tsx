import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, touchTarget } from '../../theme/tokens';
import { Icon } from '../icons';

export function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <Text style={styles.label}>
      {children}
      {required ? <Text style={styles.required}>*</Text> : null}
    </Text>
  );
}

export function FieldError({ children, testID }: { children: string; testID?: string }) {
  return (
    <View style={styles.fieldError} accessibilityRole="alert" accessibilityLiveRegion="polite" testID={testID}>
      <View style={styles.iconOffset}>
        <Icon name="circle-alert" size={16} color={colors.destructive} />
      </View>
      <Text style={styles.fieldErrorText}>{children}</Text>
    </View>
  );
}

export function FormErrorAlert({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.alert} accessibilityRole="alert" accessibilityLiveRegion="assertive" testID="form-error-alert">
      <View style={styles.iconOffset}>
        <Icon name="circle-alert" size={16} color={colors.destructive} />
      </View>
      <View style={styles.alertContent}>
        <Text style={styles.alertTitle}>{title}</Text>
        <Text style={styles.alertText}>{description}</Text>
      </View>
    </View>
  );
}

export function Field({
  label,
  required,
  error,
  errorTestID,
  counter,
  counterOver,
  onLayout,
  testID,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  errorTestID?: string;
  counter?: string;
  counterOver?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
  testID?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field} onLayout={onLayout} testID={testID}>
      <FieldLabel required={required}>{label}</FieldLabel>
      {children}
      {error || counter ? (
        <View style={styles.helper}>
          {error ? <FieldError testID={errorTestID}>{error}</FieldError> : <View style={{ flex: 1 }} />}
          {counter ? <Text style={[styles.counter, counterOver && { color: colors.destructive }]}>{counter}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

export function SelectControl({
  label,
  value,
  placeholder,
  leading,
  invalid,
  disabled,
  chevron = true,
  onPress,
  testID,
  hint,
}: {
  label: string;
  value?: string | null;
  placeholder: string;
  leading?: ReactNode;
  invalid?: boolean;
  disabled?: boolean;
  chevron?: boolean;
  onPress: () => void;
  testID?: string;
  hint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value ?? placeholder}`}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[controlStyles.control, invalid && controlStyles.invalid, disabled && controlStyles.disabled]}
      testID={testID}
    >
      {leading}
      <Text style={[controlStyles.value, !value && controlStyles.placeholder]} numberOfLines={1}>
        {value ?? placeholder}
      </Text>
      {chevron ? (
        <View style={controlStyles.chevron}>
          <Icon name="chevron-down" size={16} color={colors.mutedForeground} />
        </View>
      ) : null}
    </Pressable>
  );
}

export interface SelectionOption {
  key: string;
  label: string;
  detail?: string;
  leading?: ReactNode;
}

export function SelectionSheet({
  visible,
  title,
  description,
  options,
  selectedKey,
  onSelect,
  onClose,
  testID,
}: {
  visible: boolean;
  title: string;
  description?: string;
  options: SelectionOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
  onClose: () => void;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={sheetStyles.root}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close" onPress={onClose} />
        <View style={[sheetStyles.sheet, { paddingBottom: insets.bottom + 8 }]} testID={testID}>
          <View style={sheetStyles.grabber} />
          <Text style={sheetStyles.title} accessibilityRole="header">
            {title}
          </Text>
          {description ? (
            <Text style={sheetStyles.description} numberOfLines={2}>
              {description}
            </Text>
          ) : null}
          <ScrollView style={{ maxHeight: 420 }}>
            {options.map((option) => {
              const selected = option.key === selectedKey;
              return (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.detail ? `${option.label}, ${option.detail}` : option.label}
                  onPress={() => onSelect(option.key)}
                  style={({ pressed }) => [sheetStyles.option, pressed && { backgroundColor: colors.muted }]}
                  testID={`${testID}-option-${option.key}`}
                >
                  {option.leading}
                  <Text style={sheetStyles.optionText}>{option.label}</Text>
                  {option.detail ? <Text style={sheetStyles.optionDetail}>{option.detail}</Text> : null}
                  {selected ? <Icon name="check" size={16} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.foreground },
  required: { color: colors.destructive },
  helper: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  fieldError: { flex: 1, flexDirection: 'row', gap: 6, paddingTop: 2 },
  iconOffset: { marginTop: 2 },
  fieldErrorText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.destructive },
  counter: { fontSize: 12, lineHeight: 16, paddingTop: 4, color: colors.mutedForeground },
  alert: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.destructiveBorder,
    backgroundColor: colors.alertBackground,
  },
  alertContent: { flex: 1, gap: 4 },
  alertTitle: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.destructive },
  alertText: { fontSize: 14, lineHeight: 20, color: colors.destructive },
});

export const controlStyles = StyleSheet.create({
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: touchTarget,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  focus: { borderColor: colors.ring },
  invalid: { borderColor: colors.destructive },
  disabled: { opacity: 0.5 },
  value: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 24, color: colors.foreground },
  placeholder: { color: colors.mutedForeground },
  chevron: { opacity: 0.7 },
});

const sheetStyles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 8, paddingTop: 8 },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 8 },
  title: { fontSize: 16, lineHeight: 24, fontWeight: '600', paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 12, borderRadius: radius.md },
  description: { fontSize: 14, lineHeight: 20, paddingHorizontal: 12, paddingBottom: 8, color: colors.mutedForeground },
  optionText: { flex: 1, fontSize: 16, lineHeight: 24, color: colors.foreground },
  optionDetail: { fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
});
