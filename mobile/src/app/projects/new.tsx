import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';

import { controlStyles } from '../../components/form/fields';
import { ErrorBanner, TaskScreen } from '../../components/task/TaskScreen';
import { Button } from '../../components/ui';
import { useCreateProjectForm } from '../../hooks/useCreateProjectForm';
import { colors } from '../../theme/tokens';

/** US-3: create a project from its name; the signed-in user becomes its Owner. */
export default function CreateProjectScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  const { name, setName, errors, saving, submit } = useCreateProjectForm({
    inputRef,
    // Back to the list, which reads the projects again from the backend.
    onCreated: (projectId) => router.dismissTo({ pathname: '/', params: { created: projectId } }),
  });

  const cancel = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  // Android's Back must not leave the form while the project is being created.
  useEffect(() => {
    if (!saving) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [saving]);

  return (
    <TaskScreen title="Create a project" avoidKeyboardOnAndroid testID="create-project-screen">
      <Stack.Screen options={{ gestureEnabled: !saving }} />
      <Text style={styles.subtitle}>Give your team a shared workspace.</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Project name *</Text>
        <TextInput
          ref={inputRef}
          value={name}
          onChangeText={setName}
          editable={!saving}
          autoFocus
          autoCapitalize="sentences"
          returnKeyType="done"
          onSubmitEditing={submit}
          accessibilityLabel="Project name, required"
          accessibilityHint={errors.name}
          accessibilityState={{ disabled: saving }}
          aria-invalid={!!errors.name}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            controlStyles.control,
            styles.input,
            focused && controlStyles.focus,
            !!errors.name && controlStyles.invalid,
            saving && styles.inputDisabled,
          ]}
          testID="project-name-input"
        />
        {errors.name ? (
          <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="project-name-error">
            {errors.name}
          </Text>
        ) : null}
        <Text style={styles.hint}>Required field. You will become this project’s Owner.</Text>
      </View>

      {errors.form ? <ErrorBanner>{errors.form}</ErrorBanner> : null}

      <View style={styles.actions}>
        <Button
          label={saving ? 'Creating…' : 'Create project'}
          size="lg"
          block
          loading={saving}
          onPress={submit}
          style={styles.button}
          testID="create-project-submit"
        />
        <Button
          label="Cancel"
          variant="outline"
          size="lg"
          block
          disabled={saving}
          onPress={cancel}
          style={styles.button}
          testID="cancel-button"
        />
      </View>
    </TaskScreen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 15, lineHeight: 22, color: colors.mutedForeground },
  field: { gap: 8 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.foreground },
  input: { minHeight: 48, fontSize: 16, color: colors.foreground, paddingVertical: 10 },
  inputDisabled: { color: colors.mutedForeground },
  error: { fontSize: 14, lineHeight: 20, color: colors.destructive },
  hint: { fontSize: 12, lineHeight: 16, color: colors.mutedForeground },
  actions: { gap: 8 },
  button: { height: 48 },
});
