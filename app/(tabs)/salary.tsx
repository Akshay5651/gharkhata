import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
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
import { sharePayslipPdf, sharePayslipText } from '@/lib/payslip';
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
import ProfileButton from '@/components/ProfileButton';
import ScreenBackdrop from '@/components/ScreenBackdrop';
import { showAppAlert } from '@/components/AppAlertHost';
import LedgerEntrySheet from '@/components/LedgerEntrySheet';
import PaymentSheet from '@/components/PaymentSheet';
import HistorySheet from '@/components/HistorySheet';

type Row = { helper: Helper; payroll: PayrollBreakdown; balance: WorkerBalance };

export default function SalaryScreen() {
  const router = useRouter();
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

  const canGoBack = canViewPeriod(shiftPeriod(period, -1));

  const changePeriod = (delta: number) => {
    const target = shiftPeriod(period, delta);
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
      `${preview}${more}`,
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
          <ProfileButton />
          <Text style={styles.title}>{t.salary}</Text>
        </View>
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

      <ScrollView contentContainerStyle={styles.list}>
        {rows.map(({ helper, payroll, balance }) => (
          <View key={helper.id} style={styles.card}>
            <Text style={styles.name}>{helper.name}</Text>

            <View style={styles.balanceRow}>
              <Pressable
                style={styles.balanceTap}
                onPress={() => setHistoryFor(helper)}
              >
                <View style={styles.balanceLabelRow}>
                  <Text style={styles.balanceLabel}>{t.balanceDue}</Text>
                  <Ionicons name="chevron-forward" size={12} color={colors.muted} />
                </View>
                <Text
                  style={[
                    styles.balanceValue,
                    balance.balancePaise <= 0 && styles.balanceSettled,
                  ]}
                >
                  {balance.balancePaise > 0
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
              <View style={styles.balanceActions}>
                <Pressable
                  style={styles.iconBtn}
                  onPress={() => setLedgerFor(helper)}
                  hitSlop={8}
                >
                  <Ionicons name="add" size={20} color={colors.primary} />
                </Pressable>
                <Pressable
                  style={[
                    styles.payBtn,
                    balance.balancePaise <= 0 && styles.payBtnDisabled,
                  ]}
                  onPress={() => setPaymentFor(helper)}
                  disabled={balance.balancePaise <= 0}
                >
                  <Text
                    style={[
                      styles.payBtnText,
                      balance.balancePaise <= 0 && styles.payBtnTextDisabled,
                    ]}
                  >
                    {t.recordPayment}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.divider} />

            <Text style={styles.rate}>
              {helper.salary_type === 'per_unit'
                ? `${formatINR(payroll.dayRatePaise)}/${helper.unit_label || t.unit.toLowerCase()} · ${payroll.totalQuantity} ${helper.unit_label ?? ''}`
                : `${formatINR(payroll.dayRatePaise)}/${t.perDay.toLowerCase()} · ${payroll.payableDays} ${t.payableDays.toLowerCase()}`}
            </Text>
            {payroll.isPartialMonth && (
              <Text style={styles.partial}>
                {t.partMonth}: {formatDateKey(payroll.windowStart)} –{' '}
                {formatDateKey(payroll.windowEnd)}
              </Text>
            )}

            {payroll.unmarkedDays > 0 && (
              <Pressable
                style={styles.warn}
                onPress={() => fillUnmarked({ helper, payroll })}
              >
                <Text style={styles.warnText}>
                  {t.daysBlank(payroll.unmarkedDays)} — {t.notCounted}
                </Text>
              </Pressable>
            )}

            <View style={styles.line}>
              <Text style={styles.lineLabel}>{t.earned}</Text>
              <Text style={styles.lineValue}>{formatINR(payroll.earnedPaise)}</Text>
            </View>
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

            <View style={[styles.line, styles.netLine]}>
              <Text style={styles.netLabel}>{t.netPayable}</Text>
              <Text style={styles.netValue}>
                {formatINR(payroll.netPayablePaise)}
              </Text>
            </View>

            <View style={styles.shareRow}>
              <Pressable
                style={[styles.shareBtn, styles.shareGhost]}
                onPress={() => settleAndShare(helper, payroll, sharePayslipText)}
              >
                <Text style={styles.shareGhostText}>{t.whatsapp}</Text>
              </Pressable>
              <Pressable
                style={styles.shareBtn}
                onPress={() => settleAndShare(helper, payroll, sharePayslipPdf)}
              >
                <Text style={styles.shareText}>{t.pdfSlip}</Text>
              </Pressable>
            </View>
          </View>
        ))}

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
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
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
    list: { padding: space.lg, gap: space.md },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.lg,
      gap: space.xs,
    },
    name: { fontSize: 17, fontWeight: '600', color: colors.text },
    balanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: space.xs,
    },
    balanceTap: { flexShrink: 1 },
    balanceLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    balanceLabel: { fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
    balanceValue: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 2 },
    balanceSettled: { color: colors.present },
    balanceActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    payBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
      borderRadius: radius.pill,
    },
    payBtnDisabled: { backgroundColor: colors.surfaceAlt },
    payBtnText: { color: colors.onPrimary, fontWeight: '600', fontSize: 12 },
    payBtnTextDisabled: { color: colors.muted },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: space.md },
    rate: { fontSize: 13, color: colors.muted },
    partial: { fontSize: 12, color: colors.leave, marginTop: 2 },
    warn: {
      backgroundColor: colors.warn,
      borderRadius: radius.md,
      padding: space.md,
      marginVertical: space.sm,
    },
    warnText: { fontSize: 12, color: colors.warnText },
    line: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 3,
    },
    lineLabel: { fontSize: 14, color: colors.muted },
    lineValue: { fontSize: 14, color: colors.text },
    netLine: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: space.sm,
      paddingTop: space.md,
    },
    netLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
    netValue: { fontSize: 18, fontWeight: '700', color: colors.primary },
    shareRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
    shareBtn: {
      flex: 1,
      backgroundColor: colors.primary,
      paddingVertical: space.md,
      borderRadius: radius.pill,
      alignItems: 'center',
    },
    shareText: { color: colors.onPrimary, fontWeight: '600', fontSize: 13 },
    shareGhost: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.primary,
    },
    shareGhostText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
    empty: { textAlign: 'center', color: colors.muted, marginTop: 48 },
  });
