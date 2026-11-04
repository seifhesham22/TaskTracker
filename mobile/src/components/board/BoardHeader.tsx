import { StyleSheet, Text, View } from 'react-native';

import { colors, touchTarget } from '../../theme/tokens';
import { Button, Skeleton } from '../ui';

export function BoardHeader({
  onBack,
  title,
  subtitle,
  loading,
}: {
  onBack: () => void;
  title?: string;
  subtitle?: string;
  loading?: boolean;
}) {
  return (
    <View style={styles.header}>
      <Button variant="ghost" size="lg" icon="chevron-left" accessibilityLabel="Back" onPress={onBack} textColor={colors.foreground} />
      <View style={styles.titles}>
        {loading ? (
          <>
            <Skeleton width={140} height={18} />
            <View style={{ height: 6 }} />
            <Skeleton width={96} height={12} />
          </>
        ) : title ? (
          <>
            <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 4, paddingRight: 16 },
  titles: { flex: 1, minWidth: 0, minHeight: touchTarget, justifyContent: 'center' },
  title: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: colors.foreground },
  subtitle: { fontSize: 12, lineHeight: 16, color: colors.mutedForeground },
});
