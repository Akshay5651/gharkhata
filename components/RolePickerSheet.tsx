import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, radius, space, useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';

export interface RolePickerOption {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export interface RolePickerSheetProps {
  visible: boolean;
  title: string;
  options: RolePickerOption[];
  value: string;
  onClose: () => void;
  onSelect: (label: string) => void;
}

/**
 * A vertical, scrollable list beats the old horizontal chip row once there
 * are more than a handful of roles — nothing is cut off at the edge of the
 * screen, and picking one is a single tap on a full-width row instead of a
 * swipe-then-tap.
 */
export default function RolePickerSheet({
  visible,
  title,
  options,
  value,
  onClose,
  onSelect,
}: RolePickerSheetProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: space.lg + insets.bottom }]}
          onPress={() => {}}
        >
          <View style={styles.grabber} />
          <Text style={styles.title}>{title}</Text>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {options.map((option) => {
              const active = value.trim().toLowerCase() === option.label.toLowerCase();
              return (
                <Pressable
                  key={option.label}
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => {
                    onSelect(option.label);
                    onClose();
                  }}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                      <Ionicons
                        name={option.icon ?? 'person-outline'}
                        size={16}
                        color={active ? colors.onPrimary : colors.muted}
                      />
                    </View>
                    <Text style={[styles.rowText, active && styles.rowTextActive]}>
                      {option.label}
                    </Text>
                  </View>
                  {active && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>{t.cancel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: radius.lg * 1.5,
      borderTopRightRadius: radius.lg * 1.5,
      padding: space.lg,
      maxHeight: '75%',
    },
    grabber: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: space.md,
    },
    title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: space.sm },
    list: { flexGrow: 0 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: space.md,
      paddingHorizontal: space.sm,
      borderRadius: radius.md,
    },
    rowActive: { backgroundColor: colors.surfaceAlt },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexShrink: 1 },
    iconWrap: {
      width: 30,
      height: 30,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrapActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    rowText: { fontSize: 15, color: colors.text, fontWeight: '500' },
    rowTextActive: { fontWeight: '700', color: colors.primary },
    cancelBtn: { alignItems: 'center', paddingVertical: space.md, marginTop: space.xs },
    cancelText: { color: colors.muted, fontWeight: '600', fontSize: 14 },
  });
