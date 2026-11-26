import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';

import { AccessDenied, AccessProblem, CheckingAccess } from '../../../../components/access/AccessScreens';
import { controlStyles } from '../../../../components/form/fields';
import { ErrorBanner, TaskScreen } from '../../../../components/task/TaskScreen';
import { Button } from '../../../../components/ui';
import { useBoardRepository } from '../../../../data/BoardRepositoryContext';
import { reportAccessLost } from '../../../../data/projectAccess';
import { BOARD_NAME_MAX_LENGTH, ONLY_OWNER_CREATES_BOARDS, boardBelongsTo } from '../../../../domain/createBoard';
import type { ProjectDetails } from '../../../../domain/models';
import { useAccessCheckedLoad } from '../../../../hooks/useAccessCheckedLoad';
import { useCreateBoardForm } from '../../../../hooks/useCreateBoardForm';
import { colors } from '../../../../theme/tokens';

/**
 * US-7: the project's Owner creates a board. The project is the one the screen was opened for; it
 * can't be changed here. The backend checks the role again, and creates the default columns.
 */
export default function CreateBoardScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const repository = useBoardRepository();
  const load = useCallback(() => repository.getProject(projectId ?? ''), [repository, projectId]);
  // Membership and role from the backend first; no periodic check on a form.
  const { state, retry } = useAccessCheckedLoad(projectId, load, { poll: false });
  const [refused, setRefused] = useState<'notOwner' | 'noAccess' | null>(null);

  const backToBoards = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/projects/[projectId]', params: { projectId } });
  };

  if (state.status === 'checking') return <CheckingAccess />;
  if (state.status === 'denied' || refused === 'noAccess') {
    return <AccessDenied denial={state.status === 'denied' ? state.denial : 'revoked'} />;
  }
  if (state.status === 'unverified') return <AccessProblem error={state.error} onRetry={retry} />;

  const project = state.data;
  if (project.role !== 'OWNER' || refused === 'notOwner') {
    return (
      <TaskScreen title="Create a board" testID="create-board-screen">
        <Text style={styles.subtitle}>{project.name}</Text>
        <Text style={styles.body} accessibilityRole="alert" testID="owner-only-note">
          {ONLY_OWNER_CREATES_BOARDS}
        </Text>
        <Button label="Back to boards" size="lg" block onPress={backToBoards} style={styles.button} testID="back-to-boards" />
      </TaskScreen>
    );
  }

  return (
    <CreateBoardForm
      project={project}
      onCancel={backToBoards}
      // The new board, opened by the ID the backend returned. Back from it leads to this project's
      // board list, which reads the boards again.
      onCreated={(boardId) => router.replace({ pathname: '/boards/[boardId]', params: { boardId, created: '1' } })}
      onNotOwner={() => setRefused('notOwner')}
      onNoAccess={() => {
        setRefused('noAccess');
        reportAccessLost(project.id);
      }}
    />
  );
}

function CreateBoardForm({
  project,
  onCancel,
  onCreated,
  onNotOwner,
  onNoAccess,
}: {
  project: ProjectDetails;
  onCancel: () => void;
  onCreated: (boardId: string) => void;
  onNotOwner: () => void;
  onNoAccess: () => void;
}) {
  const inputRef = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  const { name, setName, errors, saving, submit } = useCreateBoardForm({
    projectId: project.id,
    boardIdsBefore: project.boards.map((b) => b.id),
    inputRef,
    onCreated,
    onNotOwner,
    onNoAccess,
  });

  // Android's Back must not leave the form while the board is being created.
  useEffect(() => {
    if (!saving) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [saving]);

  return (
    <TaskScreen title="Create a board" avoidKeyboardOnAndroid testID="create-board-screen">
      <Stack.Screen options={{ gestureEnabled: !saving }} />
      <Text style={styles.subtitle}>{project.name}</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Board name *</Text>
        <TextInput
          ref={inputRef}
          value={name}
          onChangeText={setName}
          editable={!saving}
          autoFocus
          maxLength={BOARD_NAME_MAX_LENGTH + 20}
          placeholder="Enter a board name"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="sentences"
          returnKeyType="done"
          onSubmitEditing={submit}
          accessibilityLabel="Board name, required"
          accessibilityHint={errors.name ?? boardBelongsTo(project.name)}
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
          testID="board-name-input"
        />
        {errors.name ? (
          <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="board-name-error">
            {errors.name}
          </Text>
        ) : null}
        <Text style={styles.hint}>{boardBelongsTo(project.name)}</Text>
      </View>

      {errors.form ? <ErrorBanner>{errors.form}</ErrorBanner> : null}

      <View style={styles.actions}>
        <Button
          label={saving ? 'Creating…' : 'Create board'}
          size="lg"
          block
          loading={saving}
          onPress={submit}
          style={styles.button}
          testID="create-board-submit"
        />
        <Button
          label="Cancel"
          variant="outline"
          size="lg"
          block
          disabled={saving}
          onPress={onCancel}
          style={styles.button}
          testID="cancel-button"
        />
      </View>
    </TaskScreen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 15, lineHeight: 22, color: colors.mutedForeground },
  body: { fontSize: 16, lineHeight: 24, color: colors.foreground },
  field: { gap: 8 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.foreground },
  input: { minHeight: 48, fontSize: 16, color: colors.foreground, paddingVertical: 10 },
  inputDisabled: { color: colors.mutedForeground },
  error: { fontSize: 14, lineHeight: 20, color: colors.destructive },
  hint: { fontSize: 12, lineHeight: 16, color: colors.mutedForeground },
  actions: { gap: 8 },
  button: { height: 48 },
});
