import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AttendanceStatus, Helper } from '@/lib/types';
import { formatDateKey } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { Colors, radius, space, useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';

/** Quantities a household actually says out loud, for one-tap picking. */
const QUANTITY_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5];

export interface DayEditorProps {
  visible: boolean;
  helper: Helper | null;
  dateKey: string | null;
  status: AttendanceStatus | undefined;
  quantity: number | null;
  onClose: () => void;
  onSave: (status: AttendanceStatus | null, quantity: number | null) => void;
}

/**
 * One tap opens this instead of cycling through statuses, so changing a day
 * from Present to Leave is a single choice rather than three taps through
 * states you did not want. It is also the only place a past day's quantity
 * can be corrected.
 */
export default function DayEditor({
  visible,
  helper,
  dateKey,
  status,
  quantity,
  onClose,
  onSave,
}: DayEditorProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [draft, setDraft] = useState<AttendanceStatus | null>(status ?? null);
  const [qty, setQty] = useState<string>('');

  // Re-seed whenever a different day is opened, otherwise the sheet would
  // show whatever was left from the day before.
  useEffect(() => {
    if (!visible) return;
    setDraft(status ?? null);
    setQty(
      quantity != null
        ? String(quantity)
        : helper?.default_quantity != null
          ? String(helper.default_quantity)
          : '',
    );
  }, [visible, dateKey, status, quantity, helper]);

  if (!helper || !dateKey) return null;

  const isPerUnit = helper.salary_type === 'per_unit';
  const unit = helper.unit_label || t.unit.toLowerCase();
  const showQty = isPerUnit && draft != null && draft !== 'absent';
  const numericQty = Number(qty) > 0 ? Number(qty) : 0;

  const options: { status: AttendanceStatus; label: string; color: string }[] = [
    { status: 'present', label: t.present, color: colors.present },
    { status: 'half_day', label: t.half, color: colors.half },
    { status: 'absent', label: t.absent, color: colors.absent },
  ];

  const commit = () => {
    onSave(draft, draft && isPerUnit && draft !== 'absent' ? numericQty : null);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kav}
        >
          {/* Stops a tap inside the sheet from closing it via the backdrop. */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.grabber} />

          <Text style={styles.date}>{formatDateKey(dateKey)}</Text>
          <Text style={styles.who}>{helper.name}</Text>

          <View style={styles.options}>
            {options.map((option) => {
              const active = draft === option.status;
              return (
                <Pressable
                  key={option.status}
                  onPress={() => setDraft(option.status)}
                  style={[
                    styles.option,
                    active && {
                      backgroundColor: option.color,
                      borderColor: option.color,
                    },
                  ]}
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

          {showQty && (
            <>
              <Text style={styles.label}>
                {t.quantity} ({unit})
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presets}
              >
                {QUANTITY_PRESETS.map((value) => {
                  const active = numericQty === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setQty(String(value))}
                      style={[styles.preset, active && styles.presetActive]}
                    >
                      <Text
                        style={[
                          styles.presetText,
                          active && styles.presetTextActive,
                        ]}
                      >
                        {value}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.qtyRow}>
                <TextInput
                  style={styles.qtyInput}
                  keyboardType="decimal-pad"
                  value={qty}
                  onChangeText={setQty}
                  selectTextOnFocus
                />
                <Text style={styles.qtyUnit}>{unit}</Text>
                <Text style={styles.qtyAmount}>
                  {formatINR(Math.round(helper.salary_paise * numericQty))}
                </Text>
              </View>
            </>
          )}

          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, styles.btnGhost]}
              onPress={() => {
                setDraft(null);
                onSave(null, null);
              }}
            >
              <Text style={styles.btnGhostText}>{t.clear}</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, draft == null && styles.btnDisabled]}
              onPress={commit}
              disabled={draft == null}
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
    date: { fontSize: 18, fontWeight: '700', color: colors.text },
    who: { fontSize: 13, color: colors.muted, marginBottom: space.md },
    options: { flexDirection: 'row', gap: space.sm },
    option: {
      flex: 1,
      paddingVertical: space.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
    },
    optionText: { fontSize: 12, fontWeight: '600', color: colors.muted },
    optionTextActive: { color: '#FFFFFF' },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.muted,
      marginTop: space.lg,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    presets: { gap: space.sm, paddingVertical: space.xs },
    preset: {
      minWidth: 48,
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      marginRight: space.sm,
    },
    presetActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    presetText: { fontSize: 14, fontWeight: '600', color: colors.text },
    presetTextActive: { color: colors.onPrimary },
    qtyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      marginTop: space.sm,
    },
    qtyInput: {
      minWidth: 72,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    qtyUnit: { flex: 1, fontSize: 13, color: colors.muted },
    qtyAmount: { fontSize: 16, fontWeight: '700', color: colors.primary },
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
