import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

// Placeholder data for navigation demo only; real tasks will come from the API later.
const sampleTask = {
  title: 'Sample task',
  description: 'This is placeholder task information.',
  status: 'To do',
};

export default function TaskDetailsScreen() {
  const router = useRouter();

  const goHome = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{sampleTask.title}</Text>
      <Text style={styles.label}>Description</Text>
      <Text style={styles.value}>{sampleTask.description}</Text>
      <Text style={styles.label}>Status</Text>
      <Text style={styles.value}>{sampleTask.status}</Text>

      <Pressable style={styles.button} onPress={goHome}>
        <Text style={styles.buttonText}>Back to Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#888',
    marginTop: 12,
  },
  value: {
    fontSize: 16,
    marginTop: 4,
  },
  button: {
    marginTop: 32,
    alignSelf: 'flex-start',
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
