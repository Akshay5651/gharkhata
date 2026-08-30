import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, radius, useTheme } from '@/lib/theme';
import { getOwnerProfile, OwnerProfile } from '@/lib/profile';
import ProfileSheet from './ProfileSheet';

/**
 * The round button in the top-left of every tab, opening the household's
 * own profile. Re-reads on every focus rather than once on mount — each tab
 * keeps its own mounted instance, so a save on one tab wouldn't otherwise
 * reach the others' avatars until they happened to re-render.
 */
export default function ProfileButton() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [profile, setProfile] = useState<OwnerProfile>({
    name: '',
    phone: '',
    email: '',
    photoUri: null,
  });
  const [open, setOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setProfile(getOwnerProfile());
    }, []),
  );

  const initial = profile.name.trim().charAt(0).toUpperCase();

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={styles.btn} hitSlop={10}>
        {profile.photoUri ? (
          <Image source={{ uri: profile.photoUri }} style={styles.photo} />
        ) : initial ? (
          <Text style={styles.initial}>{initial}</Text>
        ) : (
          <Ionicons name="person-outline" size={18} color={colors.text} />
        )}
      </Pressable>
      <ProfileSheet
        visible={open}
        onClose={() => setOpen(false)}
        onSaved={setProfile}
      />
    </>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    btn: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    photo: { width: '100%', height: '100%' },
    initial: { fontSize: 16, fontWeight: '700', color: colors.primary },
  });
