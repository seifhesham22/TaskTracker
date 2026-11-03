import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>TaskTracker</Text>
      <Text style={styles.subtitle}>Welcome! Track and manage your tasks on the go.</Text>

      <Link href="/task-details" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>View sample task</Text>
        </Pressable>
      </Link>

      <View style={styles.secondLink}>
        <Link href="/boards" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>View boards</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  secondLink: {
    marginTop: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
