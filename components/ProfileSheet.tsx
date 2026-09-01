import { useEffect, useMemo, useState } from 'react';
import {
  Image,
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
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, radius, space, useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import { getOwnerProfile, OwnerProfile, saveOwnerProfile } from '@/lib/profile';
import { savePhoto } from '@/lib/photos';
import { showAppAlert } from './AppAlertHost';
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
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const p = getOwnerProfile();
    setName(p.name);
    setPhone(p.phone);
    setEmail(p.email);
    setPhoto(p.photoUri);
  }, [visible]);

  const onPickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAppAlert(t.addPhoto, t.photoPermissionBody, [{ text: t.ok }]);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (result.canceled || !result.assets?.[0]) return;
    try {
      setPhoto(savePhoto(result.assets[0].uri));
    } catch {
      showAppAlert(t.addPhoto, t.photoErrorBody, [{ text: t.ok }]);
    }
  };

  const onSave = () => {
    const profile: OwnerProfile = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      photoUri: photo,
    };
    saveOwnerProfile(profile);
    onSaved(profile);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.kav}
        >
          <Pressable
            style={[styles.sheet, { paddingBottom: space.xl + insets.bottom }]}
            onPress={() => {}}
          >
            <View style={styles.grabber} />
            <Text style={styles.title}>{t.yourProfile}</Text>
            <Text style={styles.hint}>{t.yourProfileHint}</Text>

            <Pressable style={styles.avatarWrap} onPress={onPickPhoto}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="camera-outline" size={24} color={colors.muted} />
                </View>
              )}
              <Text style={styles.avatarHint}>{photo ? t.changePhoto : t.addPhoto}</Text>
            </Pressable>

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
    avatarWrap: { alignItems: 'center', gap: space.xs, marginTop: space.md },
    avatar: {
      width: 76,
      height: 76,
      borderRadius: 38,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatarPlaceholder: {
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarHint: { fontSize: 12, fontWeight: '600', color: colors.primary },
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
