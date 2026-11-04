import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/ui';
import { colors } from '../theme/tokens';

export default function HomeScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>TaskTracker</Text>
      <Text style={styles.subtitle}>Welcome! Track and manage your tasks on the go.</Text>
      <Button label="View boards" size="lg" onPress={() => router.push('/boards')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 8,
    color: colors.foreground,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 24,
  },
});
