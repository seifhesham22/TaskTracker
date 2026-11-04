import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, touchTarget } from '../../theme/tokens';
import { Icon } from '../icons';

export const TOAST_DURATION_MS = 2500;

export function Toast({ message, tone = 'success', onHide }: { message: string; tone?: 'success' | 'error'; onHide: () => void }) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const timer = setTimeout(onHide, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [message, onHide]);

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 16 + touchTarget + 12 }]} pointerEvents="none">
      <View style={styles.toast} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="toast">
        <Icon name={tone === 'error' ? 'circle-alert' : 'check'} size={16} color={colors.primaryForeground} />
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  text: { flexShrink: 1, fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.primaryForeground },
});
