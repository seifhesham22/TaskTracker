import { forwardRef, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, touchTarget } from '../../theme/tokens';
import { Icon } from '../icons';

/** Full-screen, scrollable layout that keeps the focused field above the keyboard. */
export function AuthScreen({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          testID={testID}
        >
          <BrandHeader />
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function BrandHeader() {
  return (
    <View style={styles.brand} accessibilityRole="header" accessibilityLabel="TaskTracker">
      <Icon name="columns-3" size={16} />
      <Text style={styles.brandText}>TaskTracker</Text>
    </View>
  );
}

export function ScreenTitle({
  title,
  subtitle,
  afterStatus,
}: {
  title: string;
  subtitle?: string;
  /** Directly under a `StatusLine`, so closer to it. */
  afterStatus?: boolean;
}) {
  return (
    <View style={[styles.heading, afterStatus && styles.headingAfterStatus]}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** A confirmation line such as “✓ Account created”, above a screen title. */
export function StatusLine({ children }: { children: string }) {
  return (
    <View style={styles.statusLine}>
      <Icon name="check" size={14} />
      <Text style={styles.statusText}>{children}</Text>
    </View>
  );
}

export function RequiredNote() {
  return <Text style={styles.note}>All fields are required.</Text>;
}

/** An error for the whole form, shown above the fields. */
export function FormMessage({ children }: { children: string }) {
  return (
    <Text style={styles.formMessage} accessibilityRole="alert" accessibilityLiveRegion="assertive" testID="form-error">
      {children}
    </Text>
  );
}

export function ErrorText({ children, testID }: { children: string; testID?: string }) {
  return (
    <Text style={styles.errorText} accessibilityRole="alert" accessibilityLiveRegion="polite" testID={testID}>
      {children}
    </Text>
  );
}

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string;
  errorTestID?: string;
};

export const TextField = forwardRef<TextInputInstance, TextFieldProps>(function TextField(
  { label, error, errorTestID, editable = true, onFocus, onBlur, ...input },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityState={{ disabled: !editable }}
        aria-invalid={!!error}
        editable={editable}
        placeholderTextColor={colors.mutedForeground}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, focused && styles.inputFocused, !!error && styles.inputInvalid, !editable && styles.inputDisabled]}
        {...input}
      />
      {error ? <ErrorText testID={errorTestID}>{error}</ErrorText> : null}
    </View>
  );
});

/** Underlined inline action, such as “Show password” or “Log in”. */
export function TextLink({
  label,
  onPress,
  disabled,
  accessibilityLabel,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={12}
      testID={testID}
    >
      {({ pressed }) => <Text style={[styles.link, (pressed || disabled) && styles.linkMuted]}>{label}</Text>}
    </Pressable>
  );
}

/** “Show password” / “Hide password”. Changing it keeps the value and the keyboard where they are. */
export function PasswordToggle({
  visible,
  onToggle,
  disabled,
}: {
  visible: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.toggle}>
      <TextLink
        label={visible ? 'Hide password' : 'Show password'}
        onPress={onToggle}
        disabled={disabled}
        testID="password-visibility-toggle"
      />
    </View>
  );
}

/** “Already have an account? Log in” */
export function SwitchPrompt({
  prompt,
  action,
  onPress,
  disabled,
  testID,
}: {
  prompt: string;
  action: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchText}>{prompt} </Text>
      <TextLink label={action} onPress={onPress} disabled={disabled} testID={testID} />
    </View>
  );
}

export const authStyles = StyleSheet.create({
  fields: { gap: 20 },
  submit: { marginTop: 28 },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: touchTarget },
  brandText: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: colors.foreground },
  heading: { marginTop: 40, gap: 8 },
  headingAfterStatus: { marginTop: 12 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.5, color: colors.foreground },
  subtitle: { fontSize: 16, lineHeight: 24, color: colors.mutedForeground },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 32 },
  statusText: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.foreground },
  note: { marginTop: 16, marginBottom: 24, fontSize: 12, lineHeight: 16, color: colors.mutedForeground },
  formMessage: { marginBottom: 20, fontSize: 14, lineHeight: 20, color: colors.destructive },
  field: { gap: 8 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.foreground },
  input: {
    minHeight: touchTarget,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    fontSize: 16,
    color: colors.foreground,
  },
  inputFocused: { borderColor: colors.ring },
  inputInvalid: { borderColor: colors.destructive },
  inputDisabled: { color: colors.mutedForeground },
  errorText: { fontSize: 14, lineHeight: 20, color: colors.destructive },
  toggle: { flexDirection: 'row', marginTop: -4 },
  link: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: colors.foreground,
    textDecorationLine: 'underline',
  },
  linkMuted: { opacity: 0.6 },
  switchRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 20 },
  switchText: { fontSize: 14, lineHeight: 20, color: colors.foreground },
});
