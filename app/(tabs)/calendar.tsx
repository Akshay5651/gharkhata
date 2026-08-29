import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  clearAttendance,
  getAttendanceForPeriod,
  listHelpers,
  markAttendance,
} from '@/lib/db';
import { canViewPeriod } from '@/lib/entitlements';
import { parseWeeklyOffs } from '@/lib/salary';
import {
  currentPeriod,
  datesInPeriod,
  dayOfWeek,
  formatDateKey,
  formatPeriod,
  shiftPeriod,
  todayKey,
} from '@/lib/dates';
import { AttendanceStatus, Helper } from '@/lib/types';
import { Colors, radius, space, useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import { showAppAlert } from '@/components/AppAlertHost';
import DayEditor from '@/components/DayEditor';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Statuses shown in the legend, in the order the day editor offers them. */
const LEGEND: AttendanceStatus[] = ['present', 'half_day', 'absent'];

export default function CalendarScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [helpers, setHelpers] = useState<Helper[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [period, setPeriod] = useState(currentPeriod());
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [quantities, setQuantities] = useState<Record<string, number | null>>({});
  const [editing, setEditing] = useState<string | null>(null);

  const selected = helpers.find((h) => h.id === selectedId) ?? null;
  const today = todayKey();

  const STATUS_COLOR: Record<AttendanceStatus, string> = {
    present: colors.present,
    absent: colors.absent,
    half_day: colors.half,
    paid_leave: colors.leave,
    week_off: colors.off,
    holiday: colors.off,
  };

  const STATUS_TEXT: Record<AttendanceStatus, string> = {
    present: t.present,
    absent: t.absent,
    half_day: t.half,
    paid_leave: t.leave,
    week_off: t.weekOff,
    holiday: t.holiday,
  };

  const loadMarks = useCallback((helperId: number, forPeriod: string) => {
    const rows = getAttendanceForPeriod(helperId, forPeriod);
    setMarks(
      Object.fromEntries(rows.map((r) => [r.date, r.status])) as Record<
        string,
        AttendanceStatus
      >,
    );
    setQuantities(Object.fromEntries(rows.map((r) => [r.date, r.quantity])));
  }, []);

  /**
   * Per-worker "marked / markable" for this month, so each chip says how far
   * along that person is without having to switch to them first. Counted the
   * same way the footer and the salary screen count, so all three agree.
   */
  const stats = useMemo(() => {
    const out: Record<number, { marked: number; total: number }> = {};
    for (const helper of helpers) {
      const helperOffs = parseWeeklyOffs(helper);
      const rows = getAttendanceForPeriod(helper.id, period);
      const marked = new Set(rows.map((r) => r.date));
      let total = 0;
      let done = 0;
      for (const dateKey of datesInPeriod(period)) {
        if (dateKey > today) continue;
        if (dateKey < helper.start_date) continue;
        if (helper.end_date && dateKey > helper.end_date) continue;
        if (!marked.has(dateKey) && helperOffs.includes(dayOfWeek(dateKey))) {
          continue;
        }
        total += 1;
        if (marked.has(dateKey)) done += 1;
      }
      out[helper.id] = { marked: done, total };
    }
    return out;
  }, [helpers, period, today, marks]);

  const load = useCallback(() => {
    const list = listHelpers();
    setHelpers(list);
    const active =
      list.find((h) => h.id === selectedId) ?? (list.length > 0 ? list[0] : null);
    setSelectedId(active?.id ?? null);
    if (active) loadMarks(active.id, period);
    else setMarks({});
  }, [selectedId, period, loadMarks]);

  useFocusEffect(useCallback(() => load(), [load]));

  const canGoBack = canViewPeriod(shiftPeriod(period, -1));

  const changePeriod = (delta: number) => {
    const target = shiftPeriod(period, delta);
    if (delta < 0 && !canViewPeriod(target)) {
      showAppAlert(t.olderMonths, t.olderMonthsBody, [{ text: t.ok }]);
      return;
    }
    setPeriod(target);
    if (selectedId) loadMarks(selectedId, target);
  };

  const offs = useMemo(
    () => (selected ? parseWeeklyOffs(selected) : []),
    [selected],
  );

  const cells = useMemo(() => {
    const days = datesInPeriod(period);
    const leading = days.length > 0 ? dayOfWeek(days[0]) : 0;
    return [...Array<null>(leading).fill(null), ...days];
  }, [period]);

  // One tap opens the editor rather than cycling: picking Leave when the day
  // says Present is one choice, not three taps through Absent and Half.
  const onTapDay = (dateKey: string) => {
    if (!selected) return;

    if (dateKey > today) {
      showAppAlert(t.futureDay, t.futureDayBody, [{ text: t.ok }]);
      return;
    }
    if (dateKey < selected.start_date) {
      showAppAlert(t.beforeStart, t.beforeStartBody, [{ text: t.ok }]);
      return;
    }
    if (selected.end_date && dateKey > selected.end_date) {
      showAppAlert(t.afterEnd, t.afterEndBody, [{ text: t.ok }]);
      return;
    }

    setEditing(dateKey);
  };

  const onSaveDay = (
    status: AttendanceStatus | null,
    quantity: number | null,
  ) => {
    if (!selected || !editing) return;
    if (status) markAttendance(selected.id, editing, status, { quantity });
    else clearAttendance(selected.id, editing);
    loadMarks(selected.id, period);
    setEditing(null);
  };

  const markedCount = Object.keys(marks).length;

  // Count only days that could actually be marked: past-or-today, inside the
  // engagement, and not an implied weekly off. This has to agree with what
  // the salary screen calls unmarked, or the two screens contradict.
  const blankCount = useMemo(() => {
    if (!selected) return 0;
    return datesInPeriod(period).filter(
      (dateKey) =>
        dateKey <= today &&
        dateKey >= selected.start_date &&
        (selected.end_date == null || dateKey <= selected.end_date) &&
        !marks[dateKey] &&
        !offs.includes(dayOfWeek(dateKey)),
    ).length;
  }, [selected, period, marks, offs, today]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.calendar}</Text>
        <View style={styles.periodRow}>
          <Pressable onPress={() => changePeriod(-1)} hitSlop={8}>
            <Text style={[styles.arrow, !canGoBack && styles.arrowLocked]}>‹</Text>
          </Pressable>
          <Text style={styles.period}>{formatPeriod(period)}</Text>
          <Pressable onPress={() => changePeriod(1)} hitSlop={8}>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        </View>
      </View>

      {helpers.length > 1 && (
        <View style={styles.tabsWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabs}
          >
            {helpers.map((helper) => {
              const active = selectedId === helper.id;
              const stat = stats[helper.id];
              return (
                <Pressable
                  key={helper.id}
                  onPress={() => {
                    setSelectedId(helper.id);
                    loadMarks(helper.id, period);
                  }}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {helper.name}
                  </Text>
                  {stat && (
                    <Text
                      style={[styles.tabStat, active && styles.tabStatActive]}
                    >
                      {t.daysOf(stat.marked, stat.total)}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {!selected ? (
        <View style={styles.center}>
          <Text style={styles.empty}>{t.noWorkers}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((day, i) => (
              <Text key={`${day}-${i}`} style={styles.weekday}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((dateKey, index) => {
              if (dateKey === null) {
                return <View key={`blank-${index}`} style={styles.cell} />;
              }

              const status = marks[dateKey];
              const dayNumber = Number(dateKey.slice(-2));
              const isToday = dateKey === today;
              const isFuture = dateKey > today;
              const outOfTerm =
                dateKey < selected.start_date ||
                (selected.end_date != null && dateKey > selected.end_date);
              const disabled = isFuture || outOfTerm;
              const impliedOff = !status && offs.includes(dayOfWeek(dateKey));

              return (
                <Pressable
                  key={dateKey}
                  onPress={() => onTapDay(dateKey)}
                  // A disabled day stops reacting to touch at all, so a stray
                  // tap outside the engagement does not even flash a dialog.
                  disabled={disabled}
                  style={styles.cell}
                >
                  <View
                    style={[
                      styles.day,
                      status != null && { backgroundColor: STATUS_COLOR[status] },
                      impliedOff && styles.dayOff,
                      isToday && styles.dayToday,
                      disabled && styles.dayDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        status != null && styles.dayTextOnColor,
                        disabled && styles.dayTextDisabled,
                      ]}
                    >
                      {dayNumber}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.counter}>
            {t.daysMarked(markedCount)} · {t.stillBlank(blankCount)}
          </Text>

          <View style={styles.legend}>
            {LEGEND.map((status) => (
              <View key={status} style={styles.legendItem}>
                <View
                  style={[styles.dot, { backgroundColor: STATUS_COLOR[status] }]}
                />
                <Text style={styles.legendText}>{STATUS_TEXT[status]}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.hint}>{t.tapHint}</Text>
        </ScrollView>
      )}

      <DayEditor
        visible={editing != null}
        helper={selected}
        dateKey={editing}
        status={editing ? marks[editing] : undefined}
        quantity={editing ? (quantities[editing] ?? null) : null}
        onClose={() => setEditing(null)}
        onSave={onSaveDay}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: { paddingHorizontal: space.lg, paddingTop: space.md },
    title: { fontSize: 28, fontWeight: '700', color: colors.text },
    periodRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.lg,
      marginTop: space.sm,
    },
    arrow: { fontSize: 26, color: colors.primary, paddingHorizontal: space.sm },
    arrowLocked: { color: colors.off },
    period: { fontSize: 15, fontWeight: '600', color: colors.text },
    // The wrapper is what stops the chips stretching: a horizontal ScrollView
    // hands its full height to children, so without a bounded row they grow
    // into tall ovals.
    tabsWrap: { paddingTop: space.md },
    tabs: { paddingHorizontal: space.lg, alignItems: 'center' },
    tab: {
      paddingHorizontal: space.lg,
      paddingVertical: space.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginRight: space.sm,
      alignItems: 'center',
    },
    tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabText: { fontSize: 14, fontWeight: '600', color: colors.text },
    tabTextActive: { color: colors.onPrimary },
    tabStat: { fontSize: 11, color: colors.muted, marginTop: 1 },
    tabStatActive: { color: colors.onPrimary, opacity: 0.75 },
    body: { padding: space.lg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty: { color: colors.muted },
    weekRow: { flexDirection: 'row', marginBottom: space.sm },
    weekday: {
      flex: 1,
      textAlign: 'center',
      fontSize: 12,
      fontWeight: '600',
      color: colors.muted,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 3,
    },
    day: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dayOff: { backgroundColor: colors.surfaceAlt, borderStyle: 'dashed' },
    dayToday: { borderColor: colors.primary, borderWidth: 2 },
    dayDisabled: { backgroundColor: 'transparent', borderColor: 'transparent' },
    dayText: { fontSize: 13, fontWeight: '600', color: colors.text },
    dayTextOnColor: { color: '#FFFFFF' },
    dayTextDisabled: { color: colors.off, fontWeight: '400' },
    counter: {
      marginTop: space.lg,
      fontSize: 13,
      color: colors.muted,
      textAlign: 'center',
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: space.md,
      marginTop: space.lg,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
    dot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { fontSize: 12, color: colors.muted },
    hint: {
      marginTop: space.lg,
      fontSize: 12,
      color: colors.muted,
      textAlign: 'center',
      paddingHorizontal: space.lg,
    },
  });
