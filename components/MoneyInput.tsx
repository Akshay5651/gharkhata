import { useMemo } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors, radius, space, useTheme } from '@/lib/theme';

export interface MoneyInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}

/**
 * The ₹ only appears once there's something typed — with an empty field the
 * placeholder text already says what the number means, and a lone ₹ sitting
 * next to grey placeholder text reads as a stray symbol rather than a unit.
 */
export default function MoneyInput({
  value,
  onChangeText,
  placeholder,
}: MoneyInputProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      {value.length > 0 && <Text style={styles.prefix}>₹</Text>}
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType="decimal-pad"
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingHorizontal: space.md,
    },
    prefix: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginRight: space.xs,
    },
    input: {
      flex: 1,
      paddingVertical: space.md,
      fontSize: 15,
      color: colors.text,
    },
  });
