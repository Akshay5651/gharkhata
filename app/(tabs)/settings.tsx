import { useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  backupActionsUsed,
  canUseBackupAction,
  FREE_BACKUP_ACTIONS_PER_MONTH,
  FREE_HELPER_LIMIT,
  FREE_HISTORY_MONTHS,
  isPremium,
  recordBackupActionUsed,
} from '@/lib/entitlements';
import { exportBackupFile, importBackupFile } from '@/lib/backup';
import {
  disableExportReminder,
  enableExportReminder,
  isExportReminderEnabled,
  maybeAskExportReminder,
} from '@/lib/reminders';
import { Colors, radius, space, ThemeMode, useTheme } from '@/lib/theme';
import { Lang, LANG_NAMES, useI18n } from '@/lib/i18n';
import { showAppAlert } from '@/components/AppAlertHost';
import ProfileButton from '@/components/ProfileButton';

const FEEDBACK_EMAIL = 'akki221099@gmail.com';

/**
 * What upgrading actually buys. Kept next to the paywall copy so the promise
 * and the gates in lib/entitlements.ts stay visibly in sync.
 */
const PREMIUM_FEATURES: {
  key:
    | 'featUnlimited'
    | 'featHistory'
    | 'featBackup'
    | 'featBrandedPdf'
    | 'featReminders'
    | 'featAppLock';
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'featUnlimited', icon: 'people' },
  { key: 'featHistory', icon: 'time' },
  { key: 'featBackup', icon: 'cloud-download' },
  { key: 'featBrandedPdf', icon: 'document-text' },
  { key: 'featReminders', icon: 'notifications' },
  { key: 'featAppLock', icon: 'lock-closed' },
];

/** What the free plan already includes, shown with the same icon treatment. */
const FREE_FEATURES: {
  key: 'freeWorkersLine' | 'freeHistoryLine';
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'freeWorkersLine', icon: 'people-outline' },
  { key: 'freeHistoryLine', icon: 'time-outline' },
];

export default function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const { t, lang, setLang } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const themes: { value: ThemeMode; label: string }[] = [
    { value: 'dark', label: t.dark },
    { value: 'light', label: t.light },
  ];

  const langs: Lang[] = ['en', 'hi'];

  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [reminderOn, setReminderOn] = useState(isExportReminderEnabled());
  // No dedicated state for backup usage — it's read fresh from SQLite on
  // every render; this just forces one after a successful export/restore.
  const [, forceRerender] = useState(0);

  // First-ever visit to Settings turns the reminder on by default and asks
  // for notification permission here, where a screen about data and backups
  // gives the system prompt context — not on cold boot, which would be a
  // permission dialog with no explanation in sight.
  useEffect(() => {
    maybeAskExportReminder().then(() => setReminderOn(isExportReminderEnabled()));
  }, []);

  const onToggleReminder = async (value: boolean) => {
    if (value) {
      const result = await enableExportReminder();
      if (result === 'denied') {
        setReminderOn(false);
        showAppAlert(t.reminderDeniedTitle, t.reminderDeniedBody, [{ text: t.ok }]);
        return;
      }
      setReminderOn(true);
    } else {
      await disableExportReminder();
      setReminderOn(false);
    }
  };

  // No backend, so feedback leaves through the user's own mail app. Nothing
  // is collected or sent in the background.
  const onSendFeedback = async () => {
    const body = feedback.trim();
    if (!body) {
      showAppAlert(t.feedback, t.feedbackEmpty, [{ text: t.ok }]);
      return;
    }
    const url =
      `mailto:${FEEDBACK_EMAIL}` +
      `?subject=${encodeURIComponent('GharKhata feedback')}` +
      `&body=${encodeURIComponent(body)}`;

    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
      setFeedback('');
    } else {
      await Share.share({ message: body });
    }
  };

  const onUpgrade = () => {
    showAppAlert(t.comingSoon, t.comingSoonBody, [{ text: t.ok }]);
  };

  const onExport = async () => {
    if (!canUseBackupAction()) {
      showAppAlert(t.backupLimitTitle, t.backupLimitBody, [
        { text: t.cancel, style: 'cancel' },
        { text: t.upgrade, onPress: onUpgrade },
      ]);
      return;
    }
    setBusy('export');
    try {
      await exportBackupFile();
      recordBackupActionUsed();
      forceRerender((n) => n + 1);
    } catch (e) {
      showAppAlert('!', e instanceof Error ? e.message : String(e), [
        { text: t.ok },
      ]);
    } finally {
      setBusy(null);
    }
  };

  const onImport = () => {
    if (!canUseBackupAction()) {
      showAppAlert(t.backupLimitTitle, t.backupLimitBody, [
        { text: t.cancel, style: 'cancel' },
        { text: t.upgrade, onPress: onUpgrade },
      ]);
      return;
    }
    showAppAlert(t.restoreWarnTitle, t.restoreWarnBody, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.restore,
        style: 'destructive',
        onPress: async () => {
          setBusy('import');
          try {
            const outcome = await importBackupFile();
            if (outcome.status === 'restored') {
              recordBackupActionUsed();
              forceRerender((n) => n + 1);
              showAppAlert(t.restoreDoneTitle, t.restoreDoneBody, [{ text: t.ok }]);
            } else if (outcome.status === 'invalid') {
              showAppAlert(t.restoreBadTitle, t.restoreBadBody, [{ text: t.ok }]);
            }
          } catch (e) {
            showAppAlert('!', e instanceof Error ? e.message : String(e), [
              { text: t.ok },
            ]);
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const onBackupHelp = () => {
    showAppAlert(t.backupGuideTitle, t.backupGuideBody, [{ text: t.guideDone }]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <ProfileButton />
          <Text style={styles.title}>{t.settings}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.label}>{t.theme}</Text>
        <View style={styles.segment}>
          {themes.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setMode(option.value)}
              style={[
                styles.segmentItem,
                mode === option.value && styles.segmentItemActive,
              ]}
            >
              <Ionicons
                name={option.value === 'dark' ? 'moon' : 'sunny'}
                size={15}
                color={mode === option.value ? colors.primary : colors.muted}
              />
              <Text
                style={[
                  styles.segmentText,
                  mode === option.value && styles.segmentTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>{t.language}</Text>
        <View style={styles.segment}>
          {langs.map((value) => (
            <Pressable
              key={value}
              onPress={() => setLang(value)}
              style={[
                styles.segmentItem,
                lang === value && styles.segmentItemActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  lang === value && styles.segmentTextActive,
                ]}
              >
                {LANG_NAMES[value]}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.backupLabelRow}>
          <Text style={[styles.label, styles.labelNoMargin]}>{t.backup}</Text>
          <Pressable onPress={onBackupHelp} hitSlop={10} style={styles.helpBtn}>
            <Ionicons name="help-circle-outline" size={16} color={colors.muted} />
          </Pressable>
        </View>
        <Text style={styles.helperText}>{t.backupHint}</Text>
        {!isPremium() && (
          <Text style={styles.usageHint}>
            {t.backupUsageHint(backupActionsUsed(), FREE_BACKUP_ACTIONS_PER_MONTH)}
          </Text>
        )}
        <View style={styles.backupRow}>
          <Pressable
            style={[styles.backupBtn, styles.backupBtnGhost]}
            onPress={onExport}
            disabled={busy != null}
          >
            <Ionicons name="cloud-upload-outline" size={16} color={colors.primary} />
            <Text style={styles.backupBtnGhostText}>
              {busy === 'export' ? '…' : t.exportBackup}
            </Text>
          </Pressable>
          <Pressable
            style={styles.backupBtn}
            onPress={onImport}
            disabled={busy != null}
          >
            <Ionicons name="cloud-download-outline" size={16} color={colors.onPrimary} />
            <Text style={styles.backupBtnText}>
              {busy === 'import' ? '…' : t.restore}
            </Text>
          </Pressable>
        </View>

        <View style={styles.reminderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.reminderTitle}>{t.reminderTitle}</Text>
            <Text style={styles.reminderBody}>{t.reminderBody}</Text>
          </View>
          <Switch
            value={reminderOn}
            onValueChange={onToggleReminder}
            trackColor={{ false: colors.surfaceAlt, true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        {!isPremium() && (
          <View style={styles.planCard}>
            <View style={styles.planHead}>
              <Text style={styles.planTitle}>{t.freePlan}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{t.now}</Text>
              </View>
            </View>
            {FREE_FEATURES.map((feature) => (
              <View key={feature.key} style={styles.featureRow}>
                <View style={styles.featureIconMuted}>
                  <Ionicons name={feature.icon} size={14} color={colors.muted} />
                </View>
                <Text style={styles.featureText}>
                  {feature.key === 'freeWorkersLine'
                    ? t.freeWorkers(FREE_HELPER_LIMIT)
                    : t.freeHistory(FREE_HISTORY_MONTHS)}
                </Text>
              </View>
            ))}

            <View style={styles.divider} />

            <Text style={styles.planTitle}>{t.withUpgrade}</Text>
            {PREMIUM_FEATURES.map((feature) => (
              <View key={feature.key} style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Ionicons name={feature.icon} size={14} color={colors.primary} />
                </View>
                <Text style={styles.featureText}>{t[feature.key]}</Text>
              </View>
            ))}

            <Pressable style={styles.upgradeBtn} onPress={onUpgrade}>
              <Ionicons name="star" size={15} color={colors.onPrimary} />
              <Text style={styles.upgradeText}>{t.upgrade}</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.label}>{t.feedback}</Text>
        <TextInput
          style={styles.feedbackInput}
          placeholder={t.feedbackHint}
          placeholderTextColor={colors.muted}
          value={feedback}
          onChangeText={setFeedback}
          multiline
          textAlignVertical="top"
        />
        <Pressable style={styles.sendBtn} onPress={onSendFeedback}>
          <Text style={styles.sendText}>{t.send}</Text>
        </Pressable>

        <Text style={styles.foot}>GharKhata · v1.0.0</Text>
        <Text style={styles.watermark}>Created by Akki · © 2026</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: { paddingHorizontal: space.lg, paddingTop: space.md },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    title: { fontSize: 28, fontWeight: '700', color: colors.text },
    body: { padding: space.lg },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.muted,
      marginTop: space.lg,
      marginBottom: space.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    segment: {
      flexDirection: 'row',
      gap: space.xs,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      padding: 3,
    },
    segmentItem: {
      flex: 1,
      flexDirection: 'row',
      gap: space.xs,
      paddingVertical: space.md,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentItemActive: { backgroundColor: colors.surface },
    segmentText: { fontSize: 14, color: colors.muted, fontWeight: '600' },
    segmentTextActive: { color: colors.primary },
    planCard: {
      marginTop: space.xl,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.lg,
      gap: space.xs,
    },
    planTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: space.xs,
    },
    planLine: { fontSize: 13, color: colors.muted },
    planHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    badge: {
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: space.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.muted,
      letterSpacing: 0.5,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: space.lg,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      marginTop: space.md,
    },
    featureIcon: {
      width: 26,
      height: 26,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
    },
    featureIconMuted: {
      width: 26,
      height: 26,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bg,
    },
    featureText: { flex: 1, fontSize: 13, color: colors.text },
    upgradeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.sm,
      backgroundColor: colors.primary,
      paddingVertical: space.md,
      borderRadius: radius.pill,
      marginTop: space.md,
    },
    upgradeText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
    upgradeHint: {
      fontSize: 12,
      color: colors.muted,
      textAlign: 'center',
      marginTop: space.sm,
    },
    helperText: {
      fontSize: 12,
      color: colors.muted,
      marginTop: -space.xs,
      marginBottom: space.sm,
    },
    labelNoMargin: { marginTop: 0, marginBottom: 0 },
    backupLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      marginTop: space.lg,
    },
    helpBtn: { padding: 2 },
    usageHint: {
      fontSize: 11,
      color: colors.muted,
      marginTop: -space.xs,
      marginBottom: space.sm,
    },
    backupRow: { flexDirection: 'row', gap: space.sm },
    backupBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.xs,
      backgroundColor: colors.primary,
      paddingVertical: space.md,
      borderRadius: radius.pill,
    },
    backupBtnText: { color: colors.onPrimary, fontWeight: '600', fontSize: 13 },
    backupBtnGhost: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.primary,
    },
    backupBtnGhostText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
    reminderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: space.md,
      marginTop: space.md,
    },
    reminderTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
    reminderBody: { fontSize: 12, color: colors.muted, marginTop: 1 },
    feedbackInput: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: space.md,
      minHeight: 96,
      fontSize: 15,
      color: colors.text,
    },
    sendBtn: {
      marginTop: space.sm,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingVertical: space.md,
      borderRadius: radius.pill,
      alignItems: 'center',
    },
    sendText: { color: colors.primary, fontWeight: '600' },
    foot: {
      marginTop: space.xl,
      fontSize: 12,
      color: colors.off,
      textAlign: 'center',
    },
    watermark: {
      marginTop: space.xs,
      fontSize: 11,
      color: colors.off,
      textAlign: 'center',
    },
  });
