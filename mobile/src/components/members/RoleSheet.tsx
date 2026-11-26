import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MEMBER_ROLES, ROLE_LABELS, type MemberRole } from '../../domain/members';
import { colors, radius } from '../../theme/tokens';
import { Icon } from '../icons';
import { Button } from '../ui';

/** The design's Project role sheet. The choice counts only once Done is pressed. Mount it to open it. */
export function RoleSheet({
  accountName,
  role,
  onDone,
  onClose,
}: {
  accountName: string;
  role: MemberRole;
  onDone: (role: MemberRole) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(role);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Dismiss project role" onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} accessibilityViewIsModal testID="role-sheet">
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              Project role
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close} testID="role-close">
              <Icon name="x" size={18} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.description}>Choose {accountName}’s access to this project.</Text>
            <View style={styles.options} accessibilityRole="radiogroup">
              {MEMBER_ROLES.map((option) => {
                const selected = option.role === draft;
                return (
                  <Pressable
                    key={option.role}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={`${ROLE_LABELS[option.role]}, ${option.description}`}
                    onPress={() => setDraft(option.role)}
                    style={[styles.option, selected && styles.optionSelected]}
                    testID={`role-${option.role}`}
                  >
                    <View style={styles.optionText}>
                      <Text style={styles.optionTitle}>{ROLE_LABELS[option.role]}</Text>
                      <Text style={styles.optionDetail}>{option.description}</Text>
                    </View>
                    <View style={styles.radio}>{selected ? <View style={styles.radioDot} /> : null}</View>
                  </Pressable>
                );
              })}
            </View>
            <Button label="Done" size="lg" block style={styles.done} onPress={() => onDone(draft)} testID="role-done" />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    maxHeight: '90%',
    paddingHorizontal: 20,
    paddingTop: 8,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.background,
  },
  grabber: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '700', color: colors.foreground },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: -14 },
  content: { gap: 16 },
  description: { fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
  options: { gap: 8 },
  option: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  optionSelected: { borderColor: colors.foreground, backgroundColor: colors.muted },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.foreground },
  optionDetail: { fontSize: 13, lineHeight: 18, color: colors.mutedForeground },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.foreground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.foreground },
  done: { height: 48 },
});
