import { StyleSheet, View } from 'react-native';

import { FormErrorAlert } from '../form/fields';
import { Button } from '../ui';

export function MoveTaskErrorNotice({
  taskTitle,
  message,
  onRetry,
  onDismiss,
}: {
  taskTitle: string;
  message: string;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <View style={styles.wrap} testID="move-task-error">
      <FormErrorAlert title={`Couldn’t move “${taskTitle}”`} description={message} />
      <View style={styles.actions}>
        <Button label="Dismiss" variant="ghost" size="lg" onPress={onDismiss} />
        <Button label="Try again" icon="refresh-cw" variant="outline" size="lg" onPress={onRetry} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 12, gap: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
