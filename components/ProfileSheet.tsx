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
import { Colors, radius, space, useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import { getOwnerProfile, OwnerProfile, saveOwnerProfile } from '@/lib/profile';
import FieldLabel from './FieldLabel';

export interface ProfileSheetProps {
  visible: boolean;
  onClose: () => void;
  onSaved: (profile: OwnerProfile) => void;
}

/**
 * The household's own details — separate from a worker's. Re-seeds its
 * fields from storage only when it opens, not on every keystroke, so the
 * form doesn't fight the user's typing.
 */
export default function ProfileSheet({ visible, onClose, onSaved }: ProfileSheetProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!visible) return;
    const p = getOwnerProfile();
    setName(p.name);
    setPhone(p.phone);
    setEmail(p.email);
  }, [visible]);

  const onSave = () => {
    const profile: OwnerProfile = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
    };
    saveOwnerProfile(profile);
    onSaved(profile);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kav}
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.grabber} />
            <Text style={styles.title}>{t.yourProfile}</Text>
            <Text style={styles.hint}>{t.yourProfileHint}</Text>

            <FieldLabel text={t.name} />
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t.name}
              placeholderTextColor={colors.muted}
            />

            <FieldLabel text={t.phone} />
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={(text) => setPhone(text.replace(/\D/g, '').slice(0, 10))}
              placeholder={t.phoneHint}
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              maxLength={10}
            />

            <FieldLabel text={t.emailLabel} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t.emailHint}
              placeholderTextColor={colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Pressable style={styles.saveBtn} onPress={onSave}>
              <Text style={styles.saveText}>{t.save}</Text>
            </Pressable>
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
      paddingBottom: space.xl,
    },
    grabber: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: space.md,
    },
    title: { fontSize: 20, fontWeight: '700', color: colors.text },
    hint: { fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 18 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingHorizontal: space.md,
      paddingVertical: space.md,
      fontSize: 15,
      color: colors.text,
      marginTop: space.xs,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      paddingVertical: space.md,
      borderRadius: radius.pill,
      alignItems: 'center',
      marginTop: space.lg,
    },
    saveText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
  });
