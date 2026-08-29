import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  clearAttendance,
  getAttendanceForDate,
  getSetting,
  listHelpers,
  markAttendance,
  setSetting,
} from '@/lib/db';
import { FREE_HELPER_LIMIT, isPremium, remainingHelperSlots } from '@/lib/entitlements';
import { formatDateKey, todayKey } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { AttendanceStatus, Helper } from '@/lib/types';
import { Colors, radius, space, useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import GuideSheet from '@/components/GuideSheet';

export default function HomeScreen() {
  const router = useRouter();
  const { colors, mode, toggle } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [helpers, setHelpers] = useState<Helper[]>([]);
  const [marks, setMarks] = useState<Record<number, AttendanceStatus>>({});
  const [qty, setQty] = useState<Record<number, string>>({});
  const [slots, setSlots] = useState(FREE_HELPER_LIMIT);
  const [guideOpen, setGuideOpen] = useState(false);
  const date = todayKey();

  // Leave was merged into Absent: a household calls a day off "chhutti" and
  // does not pay for it, so a separate paid-leave state was a distinction
  // without a difference. Existing paid_leave rows still render and pay.
  const quick: { status: AttendanceStatus; label: string; color: string }[] = [
    { status: 'present', label: t.present, color: colors.present },
    { status: 'half_day', label: t.half, color: colors.half },
    { status: 'absent', label: t.absent, color: colors.absent },
  ];

  const load = useCallback(() => {
    setHelpers(listHelpers());
    setSlots(remainingHelperSlots());
    const today = getAttendanceForDate(date);
    setMarks(
      Object.fromEntries(today.map((a) => [a.helper_id, a.status])) as Record<
        number,
        AttendanceStatus
      >,
    );
    setQty(
      Object.fromEntries(
        today
          .filter((a) => a.quantity != null)
          .map((a) => [a.helper_id, String(a.quantity)]),
      ),
    );
  }, [date]);

  useFocusEffect(useCallback(() => load(), [load]));

  // First launch ever, not first focus of this tab — the flag persists in
  // SQLite, so this fires once per install, not once per app open.
  useEffect(() => {
    if (getSetting('guide_shown_once') !== '1') {
      setSetting('guide_shown_once', '1');
      setGuideOpen(true);
    }
  }, []);

  // Tapping the status a worker already has clears it, so a mistap costs one
  // more tap rather than a trip into another screen.
  const onMark = (helper: Helper, status: AttendanceStatus) => {
    if (marks[helper.id] === status) {
      clearAttendance(helper.id, date);
    } else {
      // Marking a milkman present carries their usual quantity, so the common
      // day stays one tap and only an unusual delivery needs editing.
      const existing = qty[helper.id];
      const quantity =
        helper.salary_type === 'per_unit'
          ? Number(existing) > 0
            ? Number(existing)
            : (helper.default_quantity ?? null)
          : null;
      markAttendance(helper.id, date, status, { quantity });
    }
    load();
  };

  const onQtyChange = (helper: Helper, text: string) => {
    setQty((prev) => ({ ...prev, [helper.id]: text }));
    const status = marks[helper.id];
    // Only persist once the day has a status; an edit before marking would
    // create a row with a quantity and no attendance behind it.
    if (status && Number(text) >= 0 && text !== '') {
      markAttendance(helper.id, date, status, { quantity: Number(text) });
    }
  };

  const markedCount = helpers.filter((h) => marks[h.id]).length;
  const locked = slots <= 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t.workers}</Text>
          <Text style={styles.subtitle}>
            {t.tracking(helpers.length)} · {formatDateKey(date)}
          </Text>
        </View>
        <View style={styles.headerBtns}>
          <Pressable
            onPress={() => setGuideOpen(true)}
            style={styles.themeBtn}
            hitSlop={10}
          >
            <Ionicons name="help-circle-outline" size={20} color={colors.text} />
          </Pressable>
          <Pressable onPress={toggle} style={styles.themeBtn} hitSlop={10}>
            <Ionicons
              name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'}
              size={20}
              color={colors.text}
            />
          </Pressable>
        </View>
      </View>

      <GuideSheet visible={guideOpen} onClose={() => setGuideOpen(false)} />

      {helpers.length > 0 && (
        <Text style={styles.progress}>
          {t.markedOf(markedCount, helpers.length)}
        </Text>
      )}

      <ScrollView contentContainerStyle={styles.list}>
        {helpers.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t.noWorkers}</Text>
            <Text style={styles.emptyBody}>{t.noWorkersBody}</Text>
          </View>
        ) : (
          helpers.map((helper) => (
            <View key={helper.id} style={styles.card}>
              <Pressable
                style={styles.cardHead}
                onPress={() =>
                  router.push({
                    pathname: '/worker/[id]',
                    params: { id: String(helper.id) },
                  })
                }
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{helper.name}</Text>
                  <Text style={styles.role}>
                    {helper.role || t.worker} · {formatINR(helper.salary_paise)}
                    {helper.salary_type === 'monthly'
                      ? '/mo'
                      : helper.salary_type === 'per_unit'
                        ? `/${helper.unit_label || t.unit.toLowerCase()}`
                        : '/day'}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.muted}
                />
              </Pressable>

              <View style={styles.row}>
                {quick.map((option) => {
                  const active = marks[helper.id] === option.status;
                  return (
                    <Pressable
                      key={option.status}
                      onPress={() => onMark(helper, option.status)}
                      style={[
                        styles.chip,
                        active && {
                          backgroundColor: option.color,
                          borderColor: option.color,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.chipText, active && styles.chipTextActive]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {helper.salary_type === 'per_unit' && marks[helper.id] && (
                <View style={styles.qtyRow}>
                  <Text style={styles.qtyLabel}>{t.quantity}</Text>
                  <TextInput
                    style={styles.qtyInput}
                    keyboardType="decimal-pad"
                    value={qty[helper.id] ?? ''}
                    onChangeText={(text) => onQtyChange(helper, text)}
                    placeholder={String(helper.default_quantity ?? 0)}
                    placeholderTextColor={colors.muted}
                    selectTextOnFocus
                  />
                  <Text style={styles.qtyUnit}>{helper.unit_label ?? ''}</Text>
                  <Text style={styles.qtyAmount}>
                    {formatINR(
                      Math.round(
                        helper.salary_paise *
                          (Number(qty[helper.id]) ||
                            helper.default_quantity ||
                            0),
                      ),
                    )}
                  </Text>
                </View>
              )}
            </View>
          ))
        )}

        <Pressable
          style={[styles.addRow, locked && styles.addRowLocked]}
          onPress={() =>
            !locked &&
            router.push({ pathname: '/worker/[id]', params: { id: 'new' } })
          }
        >
          <Ionicons
            name={locked ? 'lock-closed-outline' : 'add'}
            size={18}
            color={locked ? colors.muted : colors.primary}
          />
          <Text style={[styles.addText, locked && styles.addTextLocked]}>
            {locked ? t.limitReached : t.addWorker}
          </Text>
        </Pressable>

        {!isPremium() && (
          <Text style={styles.slotHint}>
            {t.slotsUsed(helpers.length, FREE_HELPER_LIMIT)}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: space.lg,
      paddingTop: space.md,
    },
    headerText: { flex: 1 },
    title: { fontSize: 28, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 14, color: colors.muted, marginTop: 2 },
    headerBtns: { flexDirection: 'row', gap: space.sm },
    themeBtn: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    progress: {
      fontSize: 13,
      color: colors.primary,
      paddingHorizontal: space.lg,
      paddingTop: space.sm,
    },
    list: { padding: space.lg, gap: space.md },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.lg,
      gap: space.md,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    name: { fontSize: 17, fontWeight: '600', color: colors.text },
    role: { fontSize: 13, color: colors.muted, marginTop: 2 },
    row: { flexDirection: 'row', gap: space.sm },
    chip: {
      flex: 1,
      paddingVertical: space.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
    },
    chipText: { fontSize: 12, fontWeight: '600', color: colors.muted },
    qtyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: space.md,
    },
    qtyLabel: { fontSize: 13, color: colors.muted },
    qtyInput: {
      minWidth: 64,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.sm,
      paddingHorizontal: space.sm,
      paddingVertical: space.xs,
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    qtyUnit: { flex: 1, fontSize: 13, color: colors.muted },
    qtyAmount: { fontSize: 14, fontWeight: '700', color: colors.primary },
    chipTextActive: { color: '#FFFFFF' },
    empty: { alignItems: 'center', paddingVertical: 48, gap: space.sm },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    emptyBody: {
      fontSize: 14,
      color: colors.muted,
      textAlign: 'center',
      paddingHorizontal: space.xl,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.sm,
      paddingVertical: space.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
    },
    addRowLocked: { backgroundColor: colors.surfaceAlt },
    addText: { color: colors.primary, fontWeight: '600' },
    addTextLocked: { color: colors.muted },
    slotHint: {
      fontSize: 12,
      color: colors.muted,
      textAlign: 'center',
      marginTop: space.xs,
    },
  });
