import { Alert, KeyboardAvoidingView, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Board, CreateTaskInput, Task } from '../../domain/models';
import { useCreateTaskForm } from '../../hooks/useCreateTaskForm';
import { colors } from '../../theme/tokens';
import { Button } from '../ui';
import { CreateTaskForm } from './CreateTaskForm';

export function CreateTaskSheet({
  board,
  columnId,
  createTask,
  onClose,
  onCreated,
  onBoardNotFound,
}: {
  board: Board;
  columnId?: string;
  createTask: (input: CreateTaskInput) => Promise<Task>;
  onClose: () => void;
  onCreated: (task: Task) => void;
  onBoardNotFound: (message: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { form, scrollRef, titleInputRef } = useCreateTaskForm({
    boardId: board.id,
    columnId,
    createTask,
    onCreated,
    onBoardNotFound,
  });
  const { submit, submitting, isDirty, onScrollBeginDrag } = form;
  const column = board.columns.find((c) => c.id === columnId) ?? board.columns[0];

  const cancel = () => {
    if (submitting) return;
    if (!isDirty) {
      onClose();
      return;
    }
    Alert.alert('Discard this task?', 'What you entered will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onClose },
    ]);
  };

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={cancel}
    >
      <View style={[styles.root, { paddingTop: insets.top }]} testID="create-task-sheet">
        <View style={styles.header}>
          <Button label="Cancel" variant="ghost" size="lg" onPress={cancel} disabled={submitting} testID="cancel-button" />
          <Text style={styles.title} accessibilityRole="header">
            New task
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={onScrollBeginDrag}
            testID="create-task-scroll"
          >
            <CreateTaskForm form={form} titleInputRef={titleInputRef} members={board.members} membersUnavailable={board.membersUnavailable} projectName={board.projectName} columnName={column?.name} />
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 8, 12) }]}>
            <Button
              label={submitting ? 'Creating…' : 'Create task'}
              size="lg"
              block
              loading={submitting}
              onPress={submit}
              testID="submit-button"
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { flex: 1, textAlign: 'center', fontSize: 16, lineHeight: 24, fontWeight: '600', color: colors.foreground },
  headerSpacer: { width: 92 },
  footer: {
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
