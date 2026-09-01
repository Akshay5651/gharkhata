import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Helper } from '@/lib/types';
import { toPaise } from '@/lib/money';
import { Colors, radius, space, useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';

export interface LedgerEntrySheetProps {
  visible: boolean;
  helper: Helper | null;
  onClose: () => void;
  onSave: (amountPaise: number, note: string | null) => void;
}

/**
 * Advance-only by design: a type picker (advance / bonus / fine) tested as
 * more friction than value for households, since giving money mid-month is
 * almost always an advance. The schema still supports bonus and fine — they
 * can come back as a "more options" toggle if that turns out wrong.
 */
export default function LedgerEntrySheet({
  visible,
  helper,
  onClose,
  onSave,
}: LedgerEntrySheetProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!visible) return;
    setAmount('');
    setNote('');
  }, [visible]);

  if (!helper) return null;

  const rupees = Number(amount);
  const valid = Number.isFinite(rupees) && rupees > 0;

  const commit = () => {
    if (!valid) return;
    onSave(toPaise(rupees), note.trim() || null);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* React Native's Modal renders in its own native window, so it does
            not get the Activity-level keyboard resize Android normally gives
            a screen — without this the sheet sits under the keyboard. */}
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.kav}
        >
          <Pressable
            style={[styles.sheet, { paddingBottom: space.xl * 1.5 + insets.bottom }]}
            onPress={() => {}}
          >
            <View style={styles.grabber} />
            <Text style={styles.title}>{t.addAdvance}</Text>
            <Text style={styles.who}>{helper.name}</Text>

            <Text style={styles.label}>{t.amount}</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.muted}
              value={amount}
              onChangeText={setAmount}
              autoFocus
            />

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
        </KeyboardAvoidingView>
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
    kav: { width: '100%' },
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
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.muted,
      marginTop: space.sm,
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
