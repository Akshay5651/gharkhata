import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, radius, space, useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';

export interface GuideSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * One scrollable sheet rather than a multi-screen first-launch tour: it is
 * reachable any time (not just once at install), costs nothing to skip, and
 * covers the same ground a screenshot carousel would with far less to build
 * and keep in sync as features change.
 */
export default function GuideSheet({ visible, onClose }: GuideSheetProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const steps: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
    { icon: 'home-outline', title: t.guideHomeTitle, body: t.guideHomeBody },
    { icon: 'calendar-outline', title: t.guideCalendarTitle, body: t.guideCalendarBody },
    { icon: 'cash-outline', title: t.guideSalaryTitle, body: t.guideSalaryBody },
    { icon: 'wallet-outline', title: t.guideBalanceTitle, body: t.guideBalanceBody },
    { icon: 'share-social-outline', title: t.guideShareTitle, body: t.guideShareBody },
    { icon: 'cloud-upload-outline', title: t.guideBackupTitle, body: t.guideBackupBody },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: space.xl + insets.bottom }]}
          onPress={() => {}}
        >
          <View style={styles.grabber} />
          <Text style={styles.title}>{t.guideTitle}</Text>

          <ScrollView style={styles.list}>
            {steps.map((step) => (
              <View key={step.title} style={styles.row}>
                <View style={styles.iconWrap}>
                  <Ionicons name={step.icon} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{step.title}</Text>
                  <Text style={styles.rowBody}>{step.body}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>{t.guideDone}</Text>
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
      paddingBottom: space.xl,
      maxHeight: '80%',
    },
    grabber: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: space.md,
    },
    title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: space.md },
    list: { marginBottom: space.sm },
    row: {
      flexDirection: 'row',
      gap: space.md,
      paddingVertical: space.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
    rowBody: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
    closeBtn: {
      marginTop: space.md,
      paddingVertical: space.md,
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    closeText: { color: colors.onPrimary, fontWeight: '700' },
  });
