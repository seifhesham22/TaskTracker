import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../ui';

export function CreateTaskButton({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.fab, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
      <Button label="New task" icon="plus" size="lg" onPress={onPress} style={styles.button} testID="create-task-button" />
    </View>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: 16 },
  button: {
    borderRadius: 9999,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
