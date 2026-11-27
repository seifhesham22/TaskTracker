import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, touchTarget } from '../../theme/tokens';
import { Icon } from '../icons';
import { Button, Skeleton } from '../ui';

/**
 * The frame of the Task details and Edit task screens in the design: the TaskTracker bar, then
 * “PROJECT / KEY-N”, the screen title and a close button, then the scrolling content.
 */
export function TaskScreen({
  title,
  breadcrumb,
  onClose,
  closeDisabled,
  avoidKeyboardOnAndroid,
  refreshing,
  onRefresh,
  scrollEnabled = true,
  testID,
  children,
}: {
  title: string;
  breadcrumb?: string;
  /** Shows the × button. */
  onClose?: () => void;
  closeDisabled?: boolean;
  /** Keeps everything scrollable above the keyboard on Android, whose edge-to-edge window isn't resized by it. */
  avoidKeyboardOnAndroid?: boolean;
  /** Pull-to-refresh: reads the screen's data from the backend again. */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** False while something on the screen is being dragged, so the drag doesn't scroll the page. */
  scrollEnabled?: boolean;
  testID?: string;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']} testID={testID}>
      <View style={styles.brandBar}>
        <Icon name="columns-3" size={16} />
        <Text style={styles.brandText}>TaskTracker</Text>
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' || avoidKeyboardOnAndroid ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          scrollEnabled={scrollEnabled}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
          testID={testID ? `${testID}-scroll` : undefined}
        >
          <View style={styles.heading}>
            <View style={styles.headingText}>
              {breadcrumb ? (
                <Text style={styles.breadcrumb} numberOfLines={1} testID="task-breadcrumb">
                  {breadcrumb.toUpperCase()}
                </Text>
              ) : null}
              <Text style={styles.title} accessibilityRole="header">
                {title}
              </Text>
            </View>
            {onClose ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              accessibilityState={{ disabled: !!closeDisabled }}
              disabled={closeDisabled}
              onPress={onClose}
              hitSlop={8}
              style={styles.close}
              testID="close-button"
            >
              <Icon name="x" size={18} color={closeDisabled ? colors.mutedForeground : colors.foreground} />
            </Pressable>
            ) : null}
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export const breadcrumbFor = (projectName: string, readableId: string) =>
  [projectName, readableId].filter(Boolean).join(' / ');

/** The red, tinted message above the form, e.g. “We couldn’t save your changes. Try again.” */
export function ErrorBanner({ children }: { children: string }) {
  return (
    <View style={styles.errorBanner} accessibilityRole="alert" accessibilityLiveRegion="assertive" testID="form-error">
      <Text style={styles.errorBannerText}>{children}</Text>
    </View>
  );
}

/** The grey “✓ Task updated” note on the details screen. */
export function SuccessBanner({ children }: { children: string }) {
  return (
    <View style={styles.successBanner} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="success-banner">
      <Icon name="check" size={14} />
      <Text style={styles.successBannerText}>{children}</Text>
    </View>
  );
}

/** The loading state of the Edit task form: grey blocks in the shape of its fields. */
export function TaskFormSkeleton() {
  return (
    <View style={styles.skeleton} testID="task-form-skeleton" accessibilityLabel="Loading task">
      {[44, 64, 44, 44].map((height, i) => (
        <View key={i} style={styles.skeletonField}>
          <Skeleton width="50%" height={20} />
          <Skeleton width="100%" height={height} />
        </View>
      ))}
    </View>
  );
}

/** “Discard changes?” with Keep editing (default) and Discard changes, as in the design. */
export function DiscardChangesDialog({
  visible,
  onKeepEditing,
  onDiscard,
}: {
  visible: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeepEditing}>
      <View style={styles.overlay}>
        <View style={styles.dialog} accessibilityViewIsModal testID="discard-dialog">
          <Text style={styles.dialogTitle} accessibilityRole="header">
            Discard changes?
          </Text>
          <Text style={styles.dialogText}>Your unsaved changes will be lost.</Text>
          <Button label="Keep editing" size="lg" block onPress={onKeepEditing} testID="keep-editing" />
          <Button label="Discard changes" variant="outline" size="lg" block onPress={onDiscard} testID="discard-changes" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandText: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: colors.foreground },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, gap: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingText: { flex: 1, gap: 2 },
  breadcrumb: { fontSize: 11, lineHeight: 16, letterSpacing: 0.3, color: colors.mutedForeground },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700', color: colors.foreground },
  close: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center', marginRight: -12 },
  errorBanner: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.destructiveBorder,
    backgroundColor: colors.destructiveTint,
  },
  errorBannerText: { fontSize: 14, lineHeight: 20, color: colors.destructive },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  successBannerText: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.foreground },
  skeleton: { gap: 16 },
  skeletonField: { gap: 8 },
  overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.overlay },
  dialog: { backgroundColor: colors.background, borderRadius: radius.xl, padding: 20, gap: 12 },
  dialogTitle: { fontSize: 18, lineHeight: 28, fontWeight: '600', color: colors.foreground },
  dialogText: { fontSize: 14, lineHeight: 20, color: colors.foreground, marginBottom: 8 },
});
