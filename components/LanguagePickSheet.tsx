import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Lang } from '@/lib/i18n';
import { Colors, radius, space, useTheme } from '@/lib/theme';

export interface LanguagePickSheetProps {
  visible: boolean;
  onSelect: (lang: Lang) => void;
}

/**
 * Shown before anything else on first launch, so the rest of the app —
 * including the guide right after it — opens in a language the user can
 * actually read. Labels are hardcoded in both languages rather than pulled
 * from useI18n(), since there is no chosen language yet to read them in.
 */
export default function LanguagePickSheet({
  visible,
  onSelect,
}: LanguagePickSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const options: { lang: Lang; label: string; sub: string }[] = [
    { lang: 'en', label: 'English', sub: 'Continue in English' },
    { lang: 'hi', label: 'हिन्दी', sub: 'हिन्दी में जारी रखें' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={[styles.card, { paddingBottom: space.xl + insets.bottom }]}>
          <View style={styles.iconWrap}>
            <Ionicons name="language" size={24} color={colors.primary} />
          </View>
          <Text style={styles.title}>Choose your language{'\n'}भाषा चुनें</Text>

          {options.map((option) => (
            <Pressable
              key={option.lang}
              style={styles.option}
              onPress={() => onSelect(option.lang)}
            >
              <Text style={styles.optionLabel}>{option.label}</Text>
              <Text style={styles.optionSub}>{option.sub}</Text>
            </Pressable>
          ))}

          <Text style={styles.footnote}>
            Change anytime in Settings · Settings में कभी भी बदलें
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: space.lg,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.bg,
      borderRadius: radius.lg * 1.5,
      padding: space.lg,
      alignItems: 'center',
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: space.md,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: space.lg,
      lineHeight: 24,
    },
    option: {
      width: '100%',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingVertical: space.md,
      paddingHorizontal: space.lg,
      alignItems: 'center',
      marginBottom: space.sm,
    },
    optionLabel: { fontSize: 17, fontWeight: '700', color: colors.text },
    optionSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
    footnote: {
      fontSize: 11,
      color: colors.muted,
      textAlign: 'center',
      marginTop: space.sm,
    },
  });
