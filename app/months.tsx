import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getAllAttendance,
  getAllLedgerEntries,
  getAllPayments,
  getHelper,
  listHelpers,
} from '@/lib/db';
import { computePayroll } from '@/lib/salary';
import { canViewPeriod } from '@/lib/entitlements';
import {
  currentPeriod,
  formatPeriod,
  periodBounds,
  periodsBetween,
  toPeriod,
} from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { Helper } from '@/lib/types';
import { Colors, radius, space, useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import { showAppAlert } from '@/components/AppAlertHost';

interface MonthRow {
  period: string;
  earnedPaise: number;
  paidPaise: number;
  balancePaise: number;
  locked: boolean;
}

/**
 * Worker-scoped when opened from Calendar (one worker's own months), or
 * household-wide when opened from Salary (every worker combined) — the two
 * screens don't share a "current worker" concept, so this branches on
 * whether a helperId came along rather than forcing one shape on both.
 */
export default function MonthsScreen() {
  const { helperId } = useLocalSearchParams<{ helperId?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const scopedHelper: Helper | null = helperId ? getHelper(Number(helperId)) : null;

  const rows = useMemo<MonthRow[]>(() => {
    const helpers = scopedHelper ? [scopedHelper] : listHelpers(true);
    if (helpers.length === 0) return [];

    const earliestStart = helpers.reduce(
      (min, h) => (h.start_date < min ? h.start_date : min),
      helpers[0].start_date,
    );
    const months = periodsBetween(toPeriod(earliestStart), currentPeriod());

    // One fetch per helper for their whole history, sliced per month below —
    // the same shape as computeWorkerBalance(), so this stays cheap even
    // with several years of data instead of re-querying per month.
    const perHelper = helpers.map((helper) => ({
      helper,
      attendance: getAllAttendance(helper.id),
      ledger: getAllLedgerEntries(helper.id),
      payments: getAllPayments(helper.id),
    }));

    let cumulativeEarned = 0;
    let cumulativePaid = 0;
    const out: MonthRow[] = [];

    for (const period of months) {
      const { start, end } = periodBounds(period);
      let earnedPaise = 0;
      let paidPaise = 0;

      for (const { helper, attendance, ledger, payments } of perHelper) {
        if (period < toPeriod(helper.start_date)) continue;
        if (helper.archived_at && period > toPeriod(helper.archived_at)) continue;

        const periodAttendance = attendance.filter((a) => a.date >= start && a.date <= end);
        const periodLedger = ledger.filter((l) => l.date >= start && l.date <= end);
        earnedPaise += computePayroll(helper, period, periodAttendance, periodLedger)
          .netPayablePaise;
        paidPaise += payments
          .filter((p) => p.paid_on >= start && p.paid_on <= end)
          .reduce((sum, p) => sum + p.amount_paise, 0);
      }

      cumulativeEarned += earnedPaise;
      cumulativePaid += paidPaise;
      out.push({
        period,
        earnedPaise,
        paidPaise,
        balancePaise: cumulativeEarned - cumulativePaid,
        locked: !canViewPeriod(period),
      });
    }

    return out.reverse();
  }, [scopedHelper]);

  const onTapLocked = () => {
    showAppAlert(t.olderMonths, t.olderMonthsBody, [{ text: t.ok }]);
  };

  const onTapMonth = (period: string) => {
    const target = scopedHelper ? '/(tabs)/calendar' : '/(tabs)/salary';
    router.push({ pathname: target, params: { period } });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.monthlyOverview}</Text>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={24} color={colors.muted} />
        </Pressable>
      </View>
      {scopedHelper && <Text style={styles.who}>{scopedHelper.name}</Text>}

      <FlatList
        data={rows}
        keyExtractor={(row) => row.period}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{t.noWorkers}</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.row, item.locked && styles.rowLocked]}
            onPress={() => (item.locked ? onTapLocked() : onTapMonth(item.period))}
          >
            <View style={styles.rowLeft}>
              {item.locked && (
                <Ionicons
                  name="lock-closed"
                  size={13}
                  color={colors.muted}
                  style={styles.lockIcon}
                />
              )}
              <Text style={styles.rowMonth}>{formatPeriod(item.period)}</Text>
            </View>
            {!item.locked && (
              <View style={styles.rowRight}>
                <View style={styles.rowStat}>
                  <Text style={styles.rowStatLabel}>{t.earned}</Text>
                  <Text style={styles.rowStatValue}>{formatINR(item.earnedPaise)}</Text>
                </View>
                <View style={styles.rowStat}>
                  <Text style={styles.rowStatLabel}>{t.balanceDue}</Text>
                  <Text
                    style={[
                      styles.rowStatValue,
                      item.balancePaise > 0 ? styles.balanceOwed : styles.balanceSettled,
                    ]}
                  >
                    {formatINR(Math.max(item.balancePaise, 0))}
                  </Text>
                </View>
              </View>
            )}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.lg,
      paddingTop: space.md,
    },
    title: { fontSize: 22, fontWeight: '700', color: colors.text },
    who: { fontSize: 13, color: colors.muted, paddingHorizontal: space.lg, marginTop: 2 },
    list: { padding: space.lg, gap: space.sm },
    empty: { textAlign: 'center', color: colors.muted, marginTop: space.xl },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingVertical: space.md,
      paddingHorizontal: space.lg,
    },
    rowLocked: { opacity: 0.55 },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
    lockIcon: { marginRight: 2 },
    rowMonth: { fontSize: 14, fontWeight: '700', color: colors.text },
    rowRight: { flexDirection: 'row', gap: space.lg },
    rowStat: { alignItems: 'flex-end' },
    rowStatLabel: { fontSize: 10, color: colors.muted, textTransform: 'uppercase' },
    rowStatValue: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 1 },
    balanceOwed: { color: colors.absent },
    balanceSettled: { color: colors.present },
  });
