import { useMemo } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Helper, LedgerEntry, Payment } from '@/lib/types';
import { formatDateKey } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { Colors, radius, space, useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';

type Row =
  | { kind: 'ledger'; entry: LedgerEntry }
  | { kind: 'payment'; entry: Payment };

export interface HistorySheetProps {
  visible: boolean;
  helper: Helper | null;
  ledger: LedgerEntry[];
  payments: Payment[];
  onClose: () => void;
  onDeleteLedger: (id: number) => void;
  onDeletePayment: (id: number) => void;
}

/**
 * The only "edit" GharKhata offers for a past entry: delete it and add the
 * correct one. A full edit form would duplicate the two entry sheets for a
 * case — fixing a mistyped amount — that happens rarely enough not to
 * justify it.
 */
export default function HistorySheet({
  visible,
  helper,
  ledger,
  payments,
  onClose,
  onDeleteLedger,
  onDeletePayment,
}: HistorySheetProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!helper) return null;

  const rows: Row[] = [
    ...ledger.map((entry): Row => ({ kind: 'ledger', entry })),
    ...payments.map((entry): Row => ({ kind: 'payment', entry })),
  ].sort((a, b) => {
    const dateA = a.kind === 'ledger' ? a.entry.date : a.entry.paid_on;
    const dateB = b.kind === 'ledger' ? b.entry.date : b.entry.paid_on;
    return dateB.localeCompare(dateA);
  });

  const typeLabel = (type: LedgerEntry['type']): string => {
    switch (type) {
      case 'advance':
      case 'loan':
        return t.advance;
      case 'bonus':
      case 'reimbursement':
        return t.bonus;
      case 'fine':
        return t.fine;
      case 'repayment':
        return t.advance;
    }
  };

  const methodLabel = (method: Payment['method']): string => {
    switch (method) {
      case 'cash':
        return t.cash;
      case 'upi':
        return t.upi;
      case 'bank':
        return t.bank;
    }
  };

  const confirmDelete = (row: Row) => {
    Alert.alert(t.deleteEntry, t.deleteEntryBody, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: () =>
          row.kind === 'ledger'
            ? onDeleteLedger(row.entry.id)
            : onDeletePayment(row.entry.id),
      },
    ]);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{t.history}</Text>
          <Text style={styles.who}>{helper.name}</Text>

          <ScrollView style={styles.list}>
            {rows.length === 0 && (
              <Text style={styles.empty}>{t.noEntries}</Text>
            )}
            {rows.map((row) => {
              const isLedger = row.kind === 'ledger';
              const isPositive = isLedger
                ? row.entry.type === 'bonus' || row.entry.type === 'reimbursement'
                : false;
              const dateKey = isLedger ? row.entry.date : row.entry.paid_on;
              const label = isLedger
                ? typeLabel(row.entry.type)
                : `${t.recordPayment} · ${methodLabel(row.entry.method)}`;

              return (
                <View key={`${row.kind}-${row.entry.id}`} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{label}</Text>
                    <Text style={styles.rowDate}>{formatDateKey(dateKey)}</Text>
                    {row.entry.note ? (
                      <Text style={styles.rowNote}>{row.entry.note}</Text>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.rowAmount,
                      isPositive || !isLedger
                        ? styles.rowAmountPos
                        : styles.rowAmountNeg,
                    ]}
                  >
                    {isPositive || !isLedger ? '−' : '+'}
                    {formatINR(row.entry.amount_paise)}
                  </Text>
                  <Pressable
                    style={styles.trash}
                    onPress={() => confirmDelete(row)}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={colors.muted}
                    />
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>{t.cancel}</Text>
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
    title: { fontSize: 18, fontWeight: '700', color: colors.text },
    who: { fontSize: 13, color: colors.muted, marginBottom: space.md },
    list: { marginTop: space.xs },
    empty: {
      textAlign: 'center',
      color: colors.muted,
      paddingVertical: space.xl,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: space.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: space.sm,
    },
    rowLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
    rowDate: { fontSize: 12, color: colors.muted, marginTop: 1 },
    rowNote: { fontSize: 12, color: colors.muted, marginTop: 2, fontStyle: 'italic' },
    rowAmount: { fontSize: 14, fontWeight: '700' },
    rowAmountPos: { color: colors.present },
    rowAmountNeg: { color: colors.absent },
    trash: { padding: space.xs },
    closeBtn: {
      marginTop: space.lg,
      paddingVertical: space.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    closeText: { color: colors.muted, fontWeight: '600' },
  });
