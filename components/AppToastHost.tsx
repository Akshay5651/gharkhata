import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, radius, space, useTheme } from '@/lib/theme';

// Same module-level bridge pattern as AppAlertHost — a plain function
// callable from anywhere, no hook/context plumbing needed at call sites.
let listener: ((message: string) => void) | null = null;

const VISIBLE_MS = 1200;
const FADE_MS = 200;

/** Brief, non-blocking confirmation — for acknowledging a toggle/setting the user just changed, not for anything that needs an OK tap. */
export function showAppToast(message: string): void {
  listener?.(message);
}

/** Mount once near the app root — see app/_layout.tsx. */
export default function AppToastHost() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listener = (text: string) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setMessage(text);
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(
          () => setMessage(null),
        );
      }, VISIBLE_MS);
    };
    return () => {
      listener = null;
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [opacity]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { bottom: insets.bottom + space.xl, opacity }]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: space.xl,
      right: space.xl,
      alignItems: 'center',
    },
    text: {
      backgroundColor: colors.surface,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: space.sm,
      paddingHorizontal: space.lg,
      borderRadius: radius.pill,
      fontSize: 13,
      fontWeight: '600',
      overflow: 'hidden',
    },
  });
