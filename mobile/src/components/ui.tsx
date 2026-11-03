/** Small primitives translated from the shadcn/ui components in the designer handoff. */
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { initials } from '../domain/format';
import { colors, radius, touchTarget } from '../theme/tokens';
import { Icon, type IconName } from './icons';

type ButtonVariant = 'default' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'default' | 'lg';

export interface ButtonProps {
  label?: string;
  /** Leading lucide icon, e.g. "plus". */
  icon?: IconName;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  alignStart?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  textColor?: string;
}

const HEIGHTS: Record<ButtonSize, number> = { sm: 32, default: 36, lg: touchTarget };

export function Button({
  label,
  icon,
  variant = 'default',
  size = 'default',
  block,
  alignStart,
  disabled,
  loading,
  onPress,
  accessibilityLabel,
  testID,
  style,
  textColor,
}: ButtonProps) {
  const fg =
    textColor ?? (variant === 'default' ? colors.primaryForeground : colors.foreground);
  const fontSize = size === 'lg' ? 16 : 14;
  const iconOnly = !label;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      testID={testID}
      hitSlop={HEIGHTS[size] < touchTarget ? (touchTarget - HEIGHTS[size]) / 2 : undefined}
      style={({ pressed }) => [
        styles.button,
        { height: HEIGHTS[size], paddingHorizontal: iconOnly ? 0 : size === 'lg' ? 20 : size === 'sm' ? 12 : 16 },
        iconOnly && { width: HEIGHTS[size] },
        variant === 'default' && styles.primary,
        variant === 'outline' && styles.outline,
        block && styles.block,
        alignStart && styles.start,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : null}
      {!loading && icon ? <Icon name={icon} size={size === 'lg' ? 18 : 16} color={fg} /> : null}
      {label ? (
        <Text numberOfLines={1} style={[styles.label, { color: fg, fontSize, lineHeight: fontSize + 6 }]}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function Avatar({ name, unassigned, size = 24 }: { name?: string; unassigned?: boolean; size?: number }) {
  const shape = { width: size, height: size, borderRadius: size / 2 };
  if (unassigned || !name) {
    return (
      <View style={[styles.avatar, styles.avatarUnassigned, shape]} accessibilityLabel="Unassigned">
        <Icon name="user" size={size <= 24 ? 12 : 16} color={colors.mutedForeground} />
      </View>
    );
  }
  return (
    <View style={[styles.avatar, shape]} accessibilityLabel={name}>
      <Text style={[styles.avatarText, { fontSize: size <= 24 ? 10 : 12 }]}>{initials(name)}</Text>
    </View>
  );
}

export function Skeleton({ width, height, borderRadius = radius.md }: { width: DimensionValue; height: number; borderRadius?: number }) {
  return <View style={{ width, height, borderRadius, backgroundColor: colors.skeleton }} />;
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  primary: { backgroundColor: colors.primary },
  outline: { backgroundColor: colors.background, borderColor: colors.border },
  block: { alignSelf: 'stretch' },
  start: { justifyContent: 'flex-start' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  label: { fontWeight: '500', flexShrink: 0 },
  avatar: {
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarUnassigned: { backgroundColor: colors.background, borderStyle: 'dashed', borderColor: colors.mutedForeground },
  avatarText: { fontWeight: '500', color: colors.foreground, lineHeight: 12 },
});

