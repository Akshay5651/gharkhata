import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, DateData } from 'react-native-calendars';
import { Colors, radius, space, useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';

export interface DatePickerSheetProps {
  visible: boolean;
  /** Currently selected date, YYYY-MM-DD. */
  value: string;
  /** Latest date the picker will allow, YYYY-MM-DD. */
  maxDate?: string;
  title: string;
  onClose: () => void;
  onSelect: (dateKey: string) => void;
}

/**
 * Replaces the native Android date dialog, which reads the Activity's own
 * theme rather than this app's in-app dark/light toggle — on real devices
 * that showed up as a light-themed calendar popping up over a dark app,
 * with no reliable way to force it from JS (this library's `themeVariant`
 * override only exists for iOS). Drawing the calendar ourselves means it
 * always matches whatever theme and accent color are actually active.
 */
export default function DatePickerSheet({
  visible,
  value,
  maxDate,
  title,
  onClose,
  onSelect,
}: DatePickerSheetProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const calendarTheme = useMemo(
    () => ({
      backgroundColor: colors.bg,
      calendarBackground: colors.bg,
      textSectionTitleColor: colors.muted,
      selectedDayBackgroundColor: colors.primary,
      selectedDayTextColor: colors.onPrimary,
      todayTextColor: colors.primary,
      dayTextColor: colors.text,
      textDisabledColor: colors.off,
      monthTextColor: colors.text,
      arrowColor: colors.primary,
      textMonthFontWeight: '700' as const,
      textDayFontWeight: '500' as const,
    }),
    [colors],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: space.lg + insets.bottom }]}
          onPress={() => {}}
        >
          <View style={styles.grabber} />
          <Text style={styles.title}>{title}</Text>
          <Calendar
            current={value}
            maxDate={maxDate}
            onDayPress={(day: DateData) => {
              onSelect(day.dateString);
              onClose();
            }}
            markedDates={{
              [value]: {
                selected: true,
                selectedColor: colors.primary,
                selectedTextColor: colors.onPrimary,
              },
            }}
            theme={calendarTheme}
            style={styles.calendar}
          />
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>{t.cancel}</Text>
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
    },
    grabber: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: space.md,
    },
    title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: space.sm },
    calendar: { borderRadius: radius.md },
    cancelBtn: { alignItems: 'center', paddingVertical: space.md, marginTop: space.xs },
    cancelText: { color: colors.muted, fontWeight: '600', fontSize: 14 },
  });
