import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../../theme/tokens';
import { Icon, type IconName } from '../icons';
import { Button } from '../ui';

export type BoardStateType = 'empty' | 'error' | 'notfound';

const STATES: Record<
  BoardStateType,
  { media: IconName; title: string; description: string; action: string; icon: IconName; variant: 'default' | 'outline' }
> = {
  empty: {
    media: 'clipboard-list',
    title: 'No tasks yet',
    description: 'Tasks you add to this board show up here, grouped by status.',
    action: 'Create task',
    icon: 'plus',
    variant: 'default',
  },
  error: {
    media: 'triangle-alert',
    title: 'Couldn’t load this board',
    description: 'Something went wrong while loading the tasks. Check your connection and try again.',
    action: 'Try again',
    icon: 'refresh-cw',
    variant: 'outline',
  },
  notfound: {
    media: 'search-x',
    title: 'Board not found',
    description: 'This board doesn’t exist or was deleted. Check the link, or go back to your boards.',
    action: 'Go to boards',
    icon: 'arrow-left',
    variant: 'default',
  },
};

export function BoardState({
  type,
  onAction,
  description,
  title,
}: {
  type: BoardStateType;
  onAction: () => void;
  description?: string;
  title?: string;
}) {
  const s = STATES[type];
  const destructive = type === 'error';
  return (
    <View style={styles.container} accessibilityRole={destructive ? 'alert' : undefined} testID={`board-state-${type}`}>
      <View style={styles.header}>
        <View style={[styles.media, destructive && styles.mediaDestructive]}>
          <Icon name={s.media} size={24} color={destructive ? colors.destructive : colors.foreground} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {title ?? s.title}
        </Text>
        <Text style={styles.description}>{description ?? s.description}</Text>
      </View>
      <Button label={s.action} icon={s.icon} variant={s.variant} size="lg" onPress={onAction} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 358, alignItems: 'center', gap: 24, paddingVertical: 32, paddingHorizontal: 24 },
  header: { alignItems: 'center', gap: 8 },
  media: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  mediaDestructive: { backgroundColor: colors.destructiveTint },
  title: { fontSize: 18, lineHeight: 28, fontWeight: '600', textAlign: 'center', color: colors.foreground },
  description: { fontSize: 16, lineHeight: 24, color: colors.mutedForeground, textAlign: 'center', maxWidth: 300 },
});
