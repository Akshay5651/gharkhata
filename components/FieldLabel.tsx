import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, radius, space, useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';

export interface FieldLabelProps {
  text: string;
  /** Shows a red asterisk — for fields that block saving if left empty. */
  required?: boolean;
  /** Tapping the (?) shows this as a plain-language explanation. */
  help?: string;
}

/**
 * A small themed card, not the OS's native Alert — a plain white system
 * dialog sitting on top of a dark screen read as broken rather than part of
 * the app. This costs one local bit of state per field instead of nothing,
 * but stays visually consistent in both themes.
 */
export default function FieldLabel({ text, required, help }: FieldLabelProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>
        {text}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {help ? (
        <>
          <Pressable onPress={() => setOpen(true)} hitSlop={10} style={styles.helpBtn}>
            <Ionicons
              name="help-circle-outline"
              size={15}
              color={colors.muted}
            />
          </Pressable>

          <Modal
            visible={open}
            transparent
            animationType="fade"
            onRequestClose={() => setOpen(false)}
          >
            <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
              <Pressable style={styles.card} onPress={() => {}}>
                <Text style={styles.cardTitle}>{text}</Text>
                <Text style={styles.cardBody}>{help}</Text>
                <Pressable style={styles.gotIt} onPress={() => setOpen(false)}>
                  <Text style={styles.gotItText}>{t.guideDone}</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>
        </>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      marginTop: space.sm,
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    required: { color: colors.absent },
    helpBtn: { padding: 2 },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: space.xl,
    },
    card: {
      width: '100%',
      maxWidth: 320,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: space.lg,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: space.sm,
    },
    cardBody: { fontSize: 14, color: colors.muted, lineHeight: 20 },
    gotIt: {
      marginTop: space.lg,
      backgroundColor: colors.primary,
      paddingVertical: space.sm,
      borderRadius: radius.pill,
      alignItems: 'center',
    },
    gotItText: { color: colors.onPrimary, fontWeight: '700', fontSize: 14 },
  });
