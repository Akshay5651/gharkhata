import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, radius, space, useTheme } from '@/lib/theme';

export interface AppAlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertState {
  title: string;
  message?: string;
  buttons: AppAlertButton[];
}

// A module-level bridge, not React context: this mirrors React Native's own
// Alert.alert — a plain function callable from anywhere (event handlers,
// async catch blocks) without needing to be inside a component or pass a
// hook value down through props.
let listener: ((state: AlertState | null) => void) | null = null;

/**
 * Drop-in themed replacement for Alert.alert — same call signature, so every
 * call site just swaps the import. The native Alert always renders as a
 * plain white OS dialog regardless of app theme, which looked broken on a
 * dark screen.
 */
export function showAppAlert(
  title: string,
  message?: string,
  buttons?: AppAlertButton[],
): void {
  listener?.({
    title,
    message,
    buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
  });
}

/** Mount once near the app root — see app/_layout.tsx. */
export default function AppAlertHost() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [state, setState] = useState<AlertState | null>(null);

  useEffect(() => {
    listener = setState;
    return () => {
      listener = null;
    };
  }, []);

  if (!state) return null;

  // Two buttons sit side by side like the app's other confirm/cancel pairs;
  // three or more (the calendar's Cancel/Calendar/Present) stack instead —
  // squeezing three labels into one row gets unreadably tight.
  const stacked = state.buttons.length > 2;

  const press = (button: AppAlertButton) => {
    setState(null);
    button.onPress?.();
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => setState(null)}
    >
      <Pressable style={styles.backdrop} onPress={() => setState(null)}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{state.title}</Text>
          {state.message ? <Text style={styles.body}>{state.message}</Text> : null}

          <View style={[styles.actions, stacked && styles.actionsStacked]}>
            {state.buttons.map((button, i) => {
              const cancel = button.style === 'cancel';
              const destructive = button.style === 'destructive';
              // Destructive gets its own outline treatment rather than red
              // text on the solid primary fill, which read as low-contrast.
              return (
                <Pressable
                  key={`${button.text}-${i}`}
                  onPress={() => press(button)}
                  style={[
                    styles.btn,
                    (cancel || destructive) && styles.btnGhost,
                    destructive && styles.btnDestructiveGhost,
                    !stacked && styles.btnFlex,
                  ]}
                >
                  <Text
                    style={[
                      styles.btnText,
                      cancel && styles.btnGhostText,
                      destructive && styles.btnDestructiveText,
                    ]}
                  >
                    {button.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
      alignItems: 'center',
      justifyContent: 'center',
      padding: space.xl,
    },
    card: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: space.lg,
    },
    title: { fontSize: 16, fontWeight: '700', color: colors.text },
    body: { fontSize: 14, color: colors.muted, marginTop: space.sm, lineHeight: 20 },
    actions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
    actionsStacked: { flexDirection: 'column' },
    btn: {
      backgroundColor: colors.primary,
      paddingVertical: space.sm,
      borderRadius: radius.pill,
      alignItems: 'center',
    },
    btnFlex: { flex: 1 },
    btnGhost: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    btnText: { color: colors.onPrimary, fontWeight: '700', fontSize: 14 },
    btnGhostText: { color: colors.muted, fontWeight: '600' },
    btnDestructiveGhost: { borderColor: colors.absent },
    btnDestructiveText: { color: colors.absent },
  });
