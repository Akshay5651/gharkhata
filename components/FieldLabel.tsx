import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, space, useTheme } from '@/lib/theme';

export interface FieldLabelProps {
  text: string;
  /** Shows a red asterisk — for fields that block saving if left empty. */
  required?: boolean;
  /** Tapping the (?) shows this as a plain-language explanation. */
  help?: string;
}

/**
 * A native Alert rather than a custom tooltip/popover: one line of
 * explanatory text doesn't need a positioned overlay, and Alert works
 * identically everywhere without extra layout code to get right.
 */
export default function FieldLabel({ text, required, help }: FieldLabelProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>
        {text}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {help ? (
        <Pressable
          onPress={() => Alert.alert(text, help)}
          hitSlop={10}
          style={styles.helpBtn}
        >
          <Ionicons
            name="help-circle-outline"
            size={15}
            color={colors.muted}
          />
        </Pressable>
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
  });
