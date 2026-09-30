import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { showAppAlert } from '@/components/AppAlertHost';
import { useI18n } from './i18n';

/**
 * Confirms before the hardware back button closes the app, on whichever tab
 * the user happens to be on — called from all four tab screens rather than
 * relying on the tab navigator's own back-history behavior, so it works the
 * same way no matter how the user got there. Any open sheet/modal (DayEditor,
 * ProfileSheet, etc.) still gets first crack at the back press and closes
 * itself instead, since React Native's own Modal registers its hardware-back
 * handling only while visible and takes priority over this screen-level one.
 */
export function useConfirmExitOnBack(): void {
  const { t } = useI18n();

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        showAppAlert(t.exitAppTitle, t.exitAppBody, [
          { text: t.cancel, style: 'cancel' },
          { text: t.exit, style: 'destructive', onPress: () => BackHandler.exitApp() },
        ]);
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [t]),
  );
}
