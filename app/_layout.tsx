import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Dimensions,
  Easing,
  LogBox,
  Text,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initDb } from '@/lib/db';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { I18nProvider } from '@/lib/i18n';
import AppAlertHost from '@/components/AppAlertHost';

/**
 * expo-notifications runs a push-token auto-registration side effect the
 * moment it's imported, regardless of whether push is ever used. In Expo Go
 * on Android that side effect logs a console.error and pops the LogBox red
 * screen, even though this app only ever uses local scheduled notifications
 * (unaffected by Expo Go's SDK 53+ push removal). This is Expo's own
 * documented workaround for exactly that false positive — the warning never
 * appears in a real build, only in the Expo Go dev overlay.
 */
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications (remote notifications) functionality provided by expo-notifications was removed from Expo Go',
]);

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Oversized and rotated so its edge cuts across the screen on a diagonal
// rather than a flat horizontal line — sized well past the screen's own
// diagonal so no corner is ever left uncovered mid-sweep at any rotation.
const CURTAIN_SIZE = Math.max(SCREEN_WIDTH, SCREEN_HEIGHT) * 1.8;
const CURTAIN_TRAVEL = CURTAIN_SIZE;

type SweepDir = 'up' | 'down';

function Shell() {
  const { colors, mode, accent } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;
  // Bottom-left-to-top-right ('up') or the reverse ('down') — a single
  // Animated.Value driving translateY is enough because the band is rotated
  // onto a diagonal, so a straight vertical slide already reads as diagonal
  // motion across the screen.
  // Starts fully off-screen (below, in the "about to sweep up" position) —
  // it must never rest at 0, which is the fully-covering center position.
  const curtainY = useRef(new Animated.Value(CURTAIN_TRAVEL)).current;
  const isFirstRender = useRef(true);
  const prevMode = useRef(mode);
  const lastDir = useRef<SweepDir>('up');

  // A brief dip-and-recover rather than per-color interpolation: every
  // screen computes its styles fresh from `colors` the instant `mode`
  // changes, so the swap is already instant underneath. Masking that one
  // frame with a quick fade is what makes it read as a smooth transition
  // instead of a hard cut, without animating dozens of components' colors.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevMode.current = mode;
      return;
    }

    // A mode switch always sweeps a fixed direction (dark = up, light =
    // down) so the two stay visually opposite and predictable. An
    // accent-only change has no natural direction, so it alternates from
    // whichever way the last sweep went, rather than always repeating one.
    const modeChanged = mode !== prevMode.current;
    const direction: SweepDir = modeChanged
      ? mode === 'dark'
        ? 'up'
        : 'down'
      : lastDir.current === 'up'
        ? 'down'
        : 'up';
    lastDir.current = direction;
    prevMode.current = mode;

    opacity.setValue(0.4);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();

    curtainY.setValue(direction === 'up' ? CURTAIN_TRAVEL : -CURTAIN_TRAVEL);
    Animated.timing(curtainY, {
      toValue: direction === 'up' ? -CURTAIN_TRAVEL : CURTAIN_TRAVEL,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [mode, accent, opacity, curtainY]);

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Animated.View style={{ flex: 1, opacity }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="worker/[id]"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
        </Stack>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: (SCREEN_HEIGHT - CURTAIN_SIZE) / 2,
          left: (SCREEN_WIDTH - CURTAIN_SIZE) / 2,
          width: CURTAIN_SIZE,
          height: CURTAIN_SIZE,
          backgroundColor: colors.primary,
          transform: [{ translateY: curtainY }, { rotate: '-35deg' }],
        }}
      />
      <AppAlertHost />
    </>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The database has to be open before the providers mount: both the theme
  // and the language read their stored value from it during render.
  useEffect(() => {
    try {
      initDb();
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#0B0F14' }}>
        <Text style={{ color: '#F05252', fontSize: 16 }}>
          Could not open the local database:{'\n'}
          {error}
        </Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0B0F14',
        }}
      >
        <ActivityIndicator color="#2DD4BF" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <Shell />
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
