import type { Task } from '../../domain/models';
import { FormErrorAlert } from '../form/fields';
import { StyleSheet, View } from 'react-native';

export function UnplacedTasksNotice({ tasks }: { tasks: Task[] }) {
  const count = tasks.length;
  const names = tasks.map((task) => `${task.readableId} ${task.title}`).join(', ');
  return (
    <View style={styles.wrap} testID="unplaced-tasks-notice">
      <FormErrorAlert
        title={count === 1 ? '1 task isn’t in any column' : `${count} tasks aren’t in any column`}
        description={`The server returned a column that isn’t on this board for: ${names}.`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 12 },
});
