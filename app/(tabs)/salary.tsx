import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  addLedgerEntry,
  deleteLedgerEntry,
  deletePayment,
  getAllLedgerEntries,
  getAllPayments,
  getAttendanceForPeriod,
  getLedgerForPeriod,
  listHelpers,
  markMany,
  recordPayment,
  saveSnapshot,
} from '@/lib/db';
import { sharePayslipPdf } from '@/lib/payslip';
import { canViewPeriod } from '@/lib/entitlements';
import { computePayroll, PayrollBreakdown } from '@/lib/salary';
import { computeWorkerBalance, WorkerBalance } from '@/lib/balance';
import {
  currentPeriod,
  formatDateKey,
  formatPeriod,
  shiftPeriod,
} from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { Helper, Payment } from '@/lib/types';
import { Colors, radius, space, useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import { useConfirmExitOnBack } from '@/lib/useConfirmExit';
import ProfileButton from '@/components/ProfileButton';
import ScreenBackdrop from '@/components/ScreenBackdrop';
import { showAppAlert } from '@/components/AppAlertHost';
import LedgerEntrySheet from '@/components/LedgerEntrySheet';
import PaymentSheet from '@/components/PaymentSheet';
import HistorySheet from '@/components/HistorySheet';

type Row = { helper: Helper; payroll: PayrollBreakdown; balance: WorkerBalance };

export default function SalaryScreen() {
  useConfirmExitOnBack();
  const router = useRouter();
  const { period: periodParam } = useLocalSearchParams<{ period?: string }>();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [period, setPeriod] = useState(currentPeriod());
  const [rows, setRows] = useState<Row[]>([]);
  const [ledgerFor, setLedgerFor] = useState<Helper | null>(null);
  const [paymentFor, setPaymentFor] = useState<Helper | null>(null);
  const [historyFor, setHistoryFor] = useState<Helper | null>(null);

  const load = useCallback(() => {
    setRows(
      listHelpers().map((helper) => ({
        helper,
        payroll: computePayroll(
          helper,
          period,
          getAttendanceForPeriod(helper.id, period),
          getLedgerForPeriod(helper.id, period),
        ),
        // Balance is a lifetime total, deliberately independent of whichever
        // month is on screen — it always answers "what do I owe right now".
        balance: computeWorkerBalance(helper),
      })),
    );
  }, [period]);

  useFocusEffect(useCallback(() => load(), [load]));

  // Jumping here from the Months overview screen arrives as a `period`
  // param rather than a state update — the tab screen stays mounted, so
  // this is what actually moves the view to the tapped month.
  useFocusEffect(
    useCallback(() => {
      if (periodParam && periodParam !== period && periodParam <= currentPeriod()) {
        setPeriod(periodParam);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [periodParam]),
  );

  const canGoBack = canViewPeriod(shiftPeriod(period, -1));

  const canGoForward = shiftPeriod(period, 1) <= currentPeriod();

  const changePeriod = (delta: number) => {
    const target = shiftPeriod(period, delta);
    if (delta > 0 && target > currentPeriod()) {
      showAppAlert(t.futureMonth, t.futureMonthBody, [{ text: t.ok }]);
      return;
    }
    if (delta < 0 && !canViewPeriod(target)) {
      showAppAlert(t.olderMonths, t.olderMonthsBody, [{ text: t.ok }]);
      return;
    }
    setPeriod(target);
  };

  // Spells out exactly which days will be written, then offers to open the
  // calendar instead — the bulk fill is a shortcut, not the only way.
  const fillUnmarked = (row: { helper: Helper; payroll: PayrollBreakdown }) => {
    const { unmarkedDateKeys } = row.payroll;
    if (unmarkedDateKeys.length === 0) return;

    const preview = unmarkedDateKeys.slice(0, 5).map(formatDateKey).join('\n');
    const more =
      unmarkedDateKeys.length > 5
        ? `\n+${unmarkedDateKeys.length - 5}…`
        : '';

    showAppAlert(
      t.daysBlank(unmarkedDateKeys.length),
      `${t.notCounted}

${preview}${more}`,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.calendar,
          onPress: () => router.push('/(tabs)/calendar'),
        },
        {
          text: t.present,
          onPress: () => {
            markMany(row.helper.id, unmarkedDateKeys, 'present');
            load();
          },
        },
      ],
    );
  };

  const onSaveLedger = (amountPaise: number, note: string | null) => {
    if (!ledgerFor) return;
    addLedgerEntry({
      helper_id: ledgerFor.id,
      type: 'advance',
      amount_paise: amountPaise,
      note,
    });
    setLedgerFor(null);
    load();
  };

  const onSavePayment = (
    amountPaise: number,
    method: Payment['method'],
    note: string | null,
  ) => {
    if (!paymentFor) return;
    recordPayment({
      helper_id: paymentFor.id,
      period,
      amount_paise: amountPaise,
      method,
      note,
    });
    setPaymentFor(null);
    load();
  };

  // Memoized on [historyFor, rows] rather than fetched inline in JSX: `rows`
  // changing is exactly what load() does after every save/delete, so this
  // still refreshes whenever the data actually changes, but not on every
  // unrelated re-render of the screen (a re-query on each keystroke
  // elsewhere, for two arrays that were 99% of the time unchanged).
  const historyLedger = useMemo(
    () => (historyFor ? getAllLedgerEntries(historyFor.id) : []),
    [historyFor, rows],
  );
  const historyPayments = useMemo(
    () => (historyFor ? getAllPayments(historyFor.id) : []),
    [historyFor, rows],
  );

  const onDeleteLedger = (id: number) => {
    deleteLedgerEntry(id);
    load();
  };

  const onDeletePayment = (id: number) => {
    deletePayment(id);
    load();
  };

  const settleAndShare = async (
    helper: Helper,
    payroll: PayrollBreakdown,
    share: (h: Helper, p: PayrollBreakdown) => Promise<void>,
  ) => {
    try {
      // Freeze the numbers before sharing, so a slip already sent stays
      // reproducible even if this month's attendance is edited later.
      saveSnapshot(helper.id, period, payroll);
      await share(helper, payroll);
    } catch (e) {
      showAppAlert('!', e instanceof Error ? e.message : String(e), [
        { text: t.ok },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenBackdrop icon="wallet" />
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            <ProfileButton />
            <Text style={styles.title}>{t.salary}</Text>
          </View>
          <Pressable
            style={styles.monthsBtn}
            onPress={() => router.push('/months')}
            hitSlop={10}
          >
            <Ionicons name="calendar-number-outline" size={20} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.periodRow}>
          <Pressable onPress={() => changePeriod(-1)} hitSlop={8}>
            <Text style={[styles.arrow, !canGoBack && styles.arrowLocked]}>‹</Text>
          </Pressable>
          <Pressable style={styles.periodBtn} onPress={() => router.push('/months')} hitSlop={8}>
            <Text style={styles.period}>{formatPeriod(period)}</Text>
          </Pressable>
          <Pressable onPress={() => changePeriod(1)} hitSlop={8}>
            <Text style={[styles.arrow, !canGoForward && styles.arrowLocked]}>›</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {rows.map(({ helper, payroll, balance }) => {
          const isCurrent = period === currentPeriod();
          const isPerUnit = helper.salary_type === 'per_unit';
          const isHourly = helper.salary_type === 'hourly';
          const unitWord = isPerUnit
            ? helper.unit_label || t.unit.toLowerCase()
            : isHourly
              ? t.payTypeHour.toLowerCase()
              : t.payTypeDay.toLowerCase();
          // One line of arithmetic — "9 litre × ₹10/litre" — replaces separate
          // rate and quantity rows.
          const count = isPerUnit
            ? `${payroll.totalQuantity} ${helper.unit_label ?? ''}`.trim()
            : isHourly
              ? t.hoursN(payroll.payableDays)
              : t.daysN(payroll.payableDays);
          const formula = `${count} × ${formatINR(payroll.dayRatePaise)}/${unitWord}`;
          const hasAdjustments =
            payroll.bonusesPaise > 0 ||
            payroll.advancesPaise !== 0 ||
            payroll.finesPaise > 0;
          const owed = balance.balancePaise > 0;

          return (
            <View key={helper.id} style={styles.card}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{helper.name}</Text>
                {isCurrent && (
                  <View style={styles.progressPill}>
                    <Text style={styles.progressPillText}>{t.inProgress}</Text>
                  </View>
                )}
              </View>

              <View style={styles.line}>
                <Text style={styles.lineLabel}>{formula}</Text>
                {hasAdjustments && (
                  <Text style={styles.lineValue}>{formatINR(payroll.earnedPaise)}</Text>
                )}
              </View>
              {payroll.isPartialMonth && (
                <Text style={styles.partial}>
                  {t.partMonth}: {formatDateKey(payroll.windowStart)} –{' '}
                  {formatDateKey(payroll.windowEnd)}
                </Text>
              )}
              {payroll.bonusesPaise > 0 && (
                <View style={styles.line}>
                  <Text style={styles.lineLabel}>{t.bonus}</Text>
                  <Text style={styles.lineValue}>
                    +{formatINR(payroll.bonusesPaise)}
                  </Text>
                </View>
              )}
              {payroll.advancesPaise !== 0 && (
                <View style={styles.line}>
                  <Text style={styles.lineLabel}>{t.advance}</Text>
                  <Text style={styles.lineValue}>
                    −{formatINR(payroll.advancesPaise)}
                  </Text>
                </View>
              )}
              {payroll.finesPaise > 0 && (
                <View style={styles.line}>
                  <Text style={styles.lineLabel}>{t.deduction}</Text>
                  <Text style={styles.lineValue}>−{formatINR(payroll.finesPaise)}</Text>
                </View>
              )}

              {payroll.unmarkedDays > 0 && (
                <Pressable
                  style={styles.warn}
                  onPress={() => fillUnmarked({ helper, payroll })}
                  hitSlop={6}
                >
                  <Ionicons name="alert-circle" size={14} color={colors.warnText} />
                  <Text style={styles.warnText}>
                    {t.daysBlank(payroll.unmarkedDays)}
                  </Text>
                </Pressable>
              )}

              <View style={styles.netBox}>
                <Text style={styles.netLabel}>
                  {isCurrent ? t.netSoFar : t.netPayable}
                </Text>
                <Text style={styles.netValue}>
                  {formatINR(payroll.netPayablePaise)}
                </Text>
              </View>

              <View style={styles.balanceRow}>
                <Pressable
                  style={styles.balanceTap}
                  onPress={() => setHistoryFor(helper)}
                >
                  <View style={styles.balanceLabelRow}>
                    <Text style={styles.balanceLabel}>{t.totalBalanceDue}</Text>
                    <Ionicons name="chevron-forward" size={12} color={colors.muted} />
                  </View>
                  <Text
                    style={[
                      styles.balanceValue,
                      owed ? styles.balanceOwed : styles.balanceSettled,
                    ]}
                  >
                    {owed
                      ? formatINR(balance.balancePaise)
                      : balance.balancePaise < 0
                        ? `${t.paidExtra} ${formatINR(-balance.balancePaise)}`
                        : // Zero reads two different ways: a brand-new worker with
                          // no attendance and no payments yet has nothing to settle,
                          // which is not the same claim as "paid off" — that only
                          // means something once there was actually a due to clear.
                          balance.totalDuePaise === 0 && balance.totalPaidPaise === 0
                          ? t.notStarted
                          : t.allSettled}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.payBtn, !owed && styles.payBtnDisabled]}
                  onPress={() => setPaymentFor(helper)}
                  disabled={!owed}
                >
                  <Text style={[styles.payBtnText, !owed && styles.payBtnTextDisabled]}>
                    {t.recordPayment}
                  </Text>
                </Pressable>
              </View>
              {!isCurrent && owed && (
                <Text style={styles.balanceHint}>{t.carryForwardHint}</Text>
              )}

              <View style={styles.actionRow}>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => setLedgerFor(helper)}
                >
                  <Ionicons name="add" size={16} color={colors.primary} />
                  <Text style={styles.actionText}>{t.addAdvance}</Text>
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => settleAndShare(helper, payroll, sharePayslipPdf)}
                >
                  <Ionicons name="share-outline" size={16} color={colors.primary} />
                  <Text style={styles.actionText}>{t.pdfSlip}</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {rows.length === 0 && <Text style={styles.empty}>{t.noWorkers}</Text>}
      </ScrollView>

      <LedgerEntrySheet
        visible={ledgerFor != null}
        helper={ledgerFor}
        onClose={() => setLedgerFor(null)}
        onSave={onSaveLedger}
      />
      <PaymentSheet
        visible={paymentFor != null}
        helper={paymentFor}
        balancePaise={
          paymentFor
            ? (rows.find((r) => r.helper.id === paymentFor.id)?.balance
                .balancePaise ?? 0)
            : 0
        }
        onClose={() => setPaymentFor(null)}
        onSave={onSavePayment}
      />
      <HistorySheet
        visible={historyFor != null}
        helper={historyFor}
        ledger={historyLedger}
        payments={historyPayments}
        onClose={() => {
          setHistoryFor(null);
          // The card behind the sheet can hold a stale balance visually —
          // RN's Modal is a separate native window on Android, so a state
          // update while it's open does not reliably repaint what's underneath
          // until the window closes. Reloading here, not just on delete,
          // guarantees the number is right the moment the sheet is gone.
          load();
        }}
        onDeleteLedger={onDeleteLedger}
        onDeletePayment={onDeletePayment}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
    header: { paddingHorizontal: space.lg, paddingTop: space.md },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    titleLeft: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    monthsBtn: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: { fontSize: 28, fontWeight: '700', color: colors.text },
    periodRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.lg,
      marginTop: space.sm,
    },
    arrow: { fontSize: 26, color: colors.primary, paddingHorizontal: space.sm },
    arrowLocked: { color: colors.off },
    // A pill + chevron, not bare text — signals there's a tap target here
    // (the Monthly overview screen) rather than reading as a static label.
    periodBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: space.md,
      paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    period: { fontSize: 15, fontWeight: '600', color: colors.text },
    list: { padding: space.lg, gap: space.md },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.lg,
      gap: space.xs,
    },
    name: { fontSize: 20, fontWeight: '700', color: colors.text },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    progressPill: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.pill,
      paddingHorizontal: space.sm,
      paddingVertical: 2,
    },
    progressPillText: { fontSize: 10, fontWeight: '700', color: colors.primary },
    partial: { fontSize: 12, color: colors.leave, marginTop: 2 },
    // A small pill rather than a full-width banner — the explanation lives in
    // the dialog it opens, which keeps every card a few lines shorter.
    warn: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.warn,
      borderRadius: radius.pill,
      paddingVertical: 4,
      paddingHorizontal: space.md,
      marginVertical: space.xs,
    },
    warnText: { fontSize: 12, fontWeight: '600', color: colors.warnText },
    line: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 3,
    },
    lineLabel: { fontSize: 14, color: colors.muted, flexShrink: 1 },
    lineValue: { fontSize: 14, fontWeight: '600', color: colors.text },
    // The month's bottom line gets its own tinted box and a large figure.
    netBox: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      paddingVertical: space.md,
      paddingHorizontal: space.md,
      marginTop: space.sm,
    },
    netLabel: { fontSize: 14, fontWeight: '700', color: colors.text, flexShrink: 1 },
    netValue: { fontSize: 24, fontWeight: '800', color: colors.primary },
    balanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: space.md,
      marginTop: space.md,
    },
    balanceTap: { flexShrink: 1, gap: 2 },
    balanceLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    balanceLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    balanceValue: { fontSize: 26, fontWeight: '800', color: colors.text },
    balanceHint: { fontSize: 11, color: colors.muted, marginTop: 4 },
    balanceOwed: { color: colors.absent },
    balanceSettled: { color: colors.present },
    payBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
      borderRadius: radius.pill,
    },
    payBtnDisabled: { backgroundColor: colors.surfaceAlt },
    payBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
    payBtnTextDisabled: { color: colors.muted },
    actionRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: space.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
    empty: { textAlign: 'center', color: colors.muted, marginTop: 48 },
  });
