import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { Colors, radius, useTheme } from '@/lib/theme';
import { getOwnerProfile, OwnerProfile, profileCompletion } from '@/lib/profile';
import ProfileSheet from './ProfileSheet';

const RING_SIZE = 46;
const RING_STROKE = 3;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

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
  const fraction = profileCompletion(profile);

  return (
    <>
      <View style={styles.wrap}>
        {fraction < 1 && (
          <Svg
            width={RING_SIZE}
            height={RING_SIZE}
            style={StyleSheet.absoluteFill}
          >
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke={colors.border}
              strokeWidth={RING_STROKE}
              fill="none"
            />
            {fraction > 0 && (
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={colors.primary}
                strokeWidth={RING_STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - fraction)}
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            )}
          </Svg>
        )}
        <Pressable onPress={() => setOpen(true)} style={styles.btn} hitSlop={10}>
          {profile.photoUri ? (
            <Image source={{ uri: profile.photoUri }} style={styles.photo} />
          ) : initial ? (
            <Text style={styles.initial}>{initial}</Text>
          ) : (
            <Ionicons name="person-outline" size={18} color={colors.text} />
          )}
        </Pressable>
      </View>
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
    wrap: {
      width: RING_SIZE,
      height: RING_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
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
