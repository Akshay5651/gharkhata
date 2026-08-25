import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Helper, Payment } from '@/lib/types';
import { formatINR, toPaise, toRupees } from '@/lib/money';
import { Colors, radius, space, useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';

export interface PaymentSheetProps {
  visible: boolean;
  helper: Helper | null;
  /** What's currently owed, so the amount field can start pre-filled. */
  balancePaise: number;
  onClose: () => void;
  onSave: (amountPaise: number, method: Payment['method'], note: string | null) => void;
}

export default function PaymentSheet({
  visible,
  helper,
  balancePaise,
  onClose,
  onSave,
}: PaymentSheetProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Payment['method']>('cash');
  const [note, setNote] = useState('');

  // Pre-fill with the full amount owed — paying it off in one tap is the
  // common case, and partial payment is still one edit away.
  useEffect(() => {
    if (!visible) return;
    setAmount(balancePaise > 0 ? String(toRupees(balancePaise)) : '');
    setMethod('cash');
    setNote('');
  }, [visible, balancePaise]);

  if (!helper) return null;

  const methods: { value: Payment['method']; label: string }[] = [
    { value: 'cash', label: t.cash },
    { value: 'upi', label: t.upi },
    { value: 'bank', label: t.bank },
  ];

  const rupees = Number(amount);
  const valid = Number.isFinite(rupees) && rupees > 0;

  const commit = () => {
    if (!valid) return;
    onSave(toPaise(rupees), method, note.trim() || null);
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
          <Text style={styles.title}>{t.recordPayment}</Text>
          <Text style={styles.who}>{helper.name}</Text>

          <View style={styles.context}>
            <Text style={styles.contextLabel}>{t.balanceDue}</Text>
            <Text style={styles.contextValue}>{formatINR(balancePaise)}</Text>
          </View>

          <Text style={styles.label}>{t.amount}</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={amount}
            onChangeText={setAmount}
            selectTextOnFocus
          />

          <Text style={styles.label}>{t.method}</Text>
          <View style={styles.options}>
            {methods.map((option) => {
              const active = method === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setMethod(option.value)}
                  style={[styles.option, active && styles.optionActive]}
                >
                  <Text
                    style={[styles.optionText, active && styles.optionTextActive]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>{t.noteOptional}</Text>
          <TextInput
            style={styles.input}
            placeholder={t.noteOptional}
            placeholderTextColor={colors.muted}
            value={note}
            onChangeText={setNote}
          />

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={onClose}>
              <Text style={styles.btnGhostText}>{t.cancel}</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, !valid && styles.btnDisabled]}
              onPress={commit}
              disabled={!valid}
            >
              <Text style={styles.btnText}>{t.save}</Text>
            </Pressable>
          </View>
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
      paddingBottom: space.xl * 1.5,
      gap: space.sm,
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
    context: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: space.md,
      paddingVertical: space.md,
    },
    contextLabel: { fontSize: 13, color: colors.muted },
    contextValue: { fontSize: 16, fontWeight: '700', color: colors.primary },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.muted,
      marginTop: space.lg,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingHorizontal: space.md,
      paddingVertical: space.md,
      fontSize: 16,
      color: colors.text,
      marginTop: space.xs,
    },
    options: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
    option: {
      flex: 1,
      paddingVertical: space.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
    },
    optionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    optionText: { fontSize: 13, fontWeight: '600', color: colors.muted },
    optionTextActive: { color: colors.onPrimary },
    actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
    btn: {
      flex: 1,
      backgroundColor: colors.primary,
      paddingVertical: space.md,
      borderRadius: radius.pill,
      alignItems: 'center',
    },
    btnDisabled: { opacity: 0.4 },
    btnText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
    btnGhost: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    btnGhostText: { color: colors.muted, fontWeight: '600', fontSize: 15 },
  });
