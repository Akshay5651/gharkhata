import { useEffect, useState } from 'react';
import { ActivityIndicator, LogBox, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initDb } from '@/lib/db';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { I18nProvider } from '@/lib/i18n';

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

function Shell() {
  const { colors, mode } = useTheme();
  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
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
