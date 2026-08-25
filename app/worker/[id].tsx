import { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { archiveHelper, createHelper, getHelper, updateHelper } from '@/lib/db';
import { canAddHelper } from '@/lib/entitlements';
import { engagementEndDate } from '@/lib/salary';
import { formatDateKey, fromDateKey, toDateKey, todayKey } from '@/lib/dates';
import { formatINR, toPaise, toRupees } from '@/lib/money';
import { SalaryType } from '@/lib/types';
import { Colors, radius, space, useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';

type Term = 'ongoing' | 'days' | 'months';

/** Same ladder the day editor offers, so the two screens agree. */
const QUANTITY_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5];

export default function WorkerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const isNew = id === 'new';
  const existing = useMemo(() => (isNew ? null : getHelper(Number(id))), [id, isNew]);

  const [name, setName] = useState(existing?.name ?? '');
  const [role, setRole] = useState(existing?.role ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [salary, setSalary] = useState(
    existing ? String(toRupees(existing.salary_paise)) : '',
  );
  const [salaryType, setSalaryType] = useState<SalaryType>(
    existing?.salary_type ?? 'monthly',
  );
  const [startDate, setStartDate] = useState(existing?.start_date ?? todayKey());
  const [showPicker, setShowPicker] = useState(false);
  const [unitLabel, setUnitLabel] = useState(existing?.unit_label ?? '');
  const [defaultQty, setDefaultQty] = useState(
    existing?.default_quantity != null ? String(existing.default_quantity) : '',
  );

  const [term, setTerm] = useState<Term>(existing?.end_date ? 'days' : 'ongoing');
  const [termAmount, setTermAmount] = useState('');
  // An existing fixed end date is kept as-is unless the user picks a new term,
  // so opening the edit screen and saving cannot silently shorten a contract.
  const [endDate, setEndDate] = useState<string | null>(existing?.end_date ?? null);

  const previewEnd =
    term !== 'ongoing' && Number(termAmount) > 0
      ? engagementEndDate(startDate, Number(termAmount), term)
      : term === 'ongoing'
        ? null
        : endDate;

  /**
   * A milkman is paid per litre, not per month, so picking that preset also
   * switches the pay type and unit. Everything stays editable afterwards —
   * the preset is a head start, not a lock.
   */
  const rolePresets: { label: string; salaryType?: SalaryType; unit?: string }[] = [
    { label: t.roleMaid },
    { label: t.roleCook },
    { label: t.roleMilkman, salaryType: 'per_unit', unit: 'litre' },
    { label: t.roleDriver },
    { label: t.roleNanny },
    { label: t.roleGardener },
    { label: t.roleGuard },
    { label: t.roleSweeper },
    { label: t.roleLabour, salaryType: 'daily' },
  ];

  const applyRolePreset = (preset: (typeof rolePresets)[number]) => {
    setRole(preset.label);
    if (preset.salaryType) setSalaryType(preset.salaryType);
    if (preset.unit && !unitLabel) setUnitLabel(preset.unit);
  };

  const onPickDate = (_: unknown, picked?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (picked) setStartDate(toDateKey(picked));
  };

  const onSave = () => {
    const rupees = Number(salary);
    if (!name.trim()) {
      Alert.alert(t.name, t.name);
      return;
    }
    if (!Number.isFinite(rupees) || rupees <= 0) {
      Alert.alert(
        salaryType === 'monthly' ? t.monthlySalary : t.dailyWage,
        salaryType === 'monthly' ? t.monthlySalary : t.dailyWage,
      );
      return;
    }

    const payload = {
      name: name.trim(),
      role: role.trim(),
      phone: phone.trim() || null,
      salary_paise: toPaise(rupees),
      salary_type: salaryType,
      start_date: startDate,
      end_date: term === 'ongoing' ? null : previewEnd,
      unit_label: salaryType === 'per_unit' ? unitLabel.trim() || null : null,
      default_quantity:
        salaryType === 'per_unit' && Number(defaultQty) > 0
          ? Number(defaultQty)
          : null,
    };

    if (isNew) {
      if (!canAddHelper()) {
        Alert.alert(t.limitReached, t.slotsUsed(2, 2));
        return;
      }
      createHelper(payload);
    } else {
      updateHelper(Number(id), payload);
    }
    router.back();
  };

  const onRemove = () => {
    if (isNew || !existing) return;
    Alert.alert(t.remove, existing.name, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.archive,
        style: 'destructive',
        onPress: () => {
          archiveHelper(existing.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>{isNew ? t.newWorker : t.editWorker}</Text>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={24} color={colors.muted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>{t.name}</Text>
        <TextInput
          style={styles.input}
          placeholder={t.name}
          placeholderTextColor={colors.muted}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>{t.work}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetRow}
        >
          {rolePresets.map((preset) => {
            const active = role.trim().toLowerCase() === preset.label.toLowerCase();
            return (
              <Pressable
                key={preset.label}
                onPress={() => applyRolePreset(preset)}
                style={[styles.preset, active && styles.presetActive]}
              >
                <Text
                  style={[styles.presetText, active && styles.presetTextActive]}
                >
                  {preset.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <TextInput
          style={styles.input}
          placeholder={t.workHint}
          placeholderTextColor={colors.muted}
          value={role}
          onChangeText={setRole}
        />

        <Text style={styles.label}>{t.phone}</Text>
        <TextInput
          style={styles.input}
          placeholder={t.phoneHint}
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />

        <View style={styles.segment}>
          {(
            [
              { value: 'monthly' as SalaryType, label: t.perMonth },
              { value: 'daily' as SalaryType, label: t.perDay },
              { value: 'per_unit' as SalaryType, label: t.perUnit },
            ]
          ).map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setSalaryType(option.value)}
              style={[
                styles.segmentItem,
                salaryType === option.value && styles.segmentItemActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  salaryType === option.value && styles.segmentTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {salaryType === 'per_unit' && (
          <>
            <Text style={styles.label}>{t.unit}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.unitHint}
              placeholderTextColor={colors.muted}
              value={unitLabel}
              onChangeText={setUnitLabel}
            />
          </>
        )}

        <TextInput
          style={styles.input}
          placeholder={
            salaryType === 'monthly'
              ? t.monthlySalary
              : salaryType === 'per_unit'
                ? t.ratePerUnit
                : t.dailyWage
          }
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          value={salary}
          onChangeText={setSalary}
        />

        {salaryType === 'per_unit' && (
          <>
            <Text style={styles.label}>{t.usualQty}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetRow}
            >
              {QUANTITY_PRESETS.map((value) => {
                const active = Number(defaultQty) === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setDefaultQty(String(value))}
                    style={[styles.preset, active && styles.presetActive]}
                  >
                    <Text
                      style={[styles.presetText, active && styles.presetTextActive]}
                    >
                      {value}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <TextInput
              style={styles.input}
              placeholder={`1 ${unitLabel || t.unit.toLowerCase()}`}
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              value={defaultQty}
              onChangeText={setDefaultQty}
            />
          </>
        )}

        <Text style={styles.label}>{t.hiredOn}</Text>
        <Pressable style={styles.input} onPress={() => setShowPicker(true)}>
          <Text style={styles.dateText}>{formatDateKey(startDate)}</Text>
        </Pressable>
        {showPicker && (
          <DateTimePicker
            value={fromDateKey(startDate)}
            mode="date"
            maximumDate={new Date()}
            onChange={onPickDate}
          />
        )}

        <Text style={styles.label}>{t.howLong}</Text>
        <View style={styles.segment}>
          {(
            [
              { value: 'ongoing' as Term, label: t.ongoing },
              { value: 'days' as Term, label: t.forDays },
              { value: 'months' as Term, label: t.forMonths },
            ]
          ).map((option) => (
            <Pressable
              key={option.value}
              onPress={() => {
                setTerm(option.value);
                if (option.value === 'ongoing') setEndDate(null);
              }}
              style={[
                styles.segmentItem,
                term === option.value && styles.segmentItemActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  term === option.value && styles.segmentTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {term !== 'ongoing' && (
          <>
            <TextInput
              style={styles.input}
              placeholder={t.numberOf(term === 'days' ? t.forDays : t.forMonths)}
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              value={termAmount}
              onChangeText={setTermAmount}
            />
            {previewEnd && (
              <Text style={styles.preview}>
                {formatDateKey(startDate)} → {formatDateKey(previewEnd)}
              </Text>
            )}
          </>
        )}

        <Pressable style={styles.saveBtn} onPress={onSave}>
          <Text style={styles.saveText}>{t.save}</Text>
        </Pressable>

        {!isNew && (
          <Pressable style={styles.removeBtn} onPress={onRemove}>
            <Text style={styles.removeText}>{t.remove}</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
    },
    title: { flex: 1, fontSize: 22, fontWeight: '700', color: colors.text },
    body: { padding: space.lg, gap: space.sm, paddingBottom: space.xl },
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
      fontSize: 15,
      color: colors.text,
      justifyContent: 'center',
    },
    dateText: { fontSize: 15, color: colors.text },
    segment: {
      flexDirection: 'row',
      gap: space.xs,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      padding: 3,
      marginTop: space.sm,
    },
    segmentItem: {
      flex: 1,
      paddingVertical: space.sm,
      borderRadius: radius.sm,
      alignItems: 'center',
    },
    segmentItemActive: { backgroundColor: colors.surface },
    segmentText: { fontSize: 13, color: colors.muted, fontWeight: '600' },
    segmentTextActive: { color: colors.primary },
    preview: { fontSize: 12, color: colors.primary, paddingHorizontal: space.xs },
    presetRow: { paddingVertical: space.xs },
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
    presetText: { fontSize: 13, fontWeight: '600', color: colors.text },
    presetTextActive: { color: colors.onPrimary },
    saveBtn: {
      backgroundColor: colors.primary,
      paddingVertical: space.md,
      borderRadius: radius.pill,
      alignItems: 'center',
      marginTop: space.lg,
    },
    saveText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
    removeBtn: { alignItems: 'center', paddingVertical: space.lg },
    removeText: { color: colors.absent, fontWeight: '600', fontSize: 13 },
  });
