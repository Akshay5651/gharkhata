import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getSetting, setSetting } from './db';

const CHANNEL_ID = 'export-reminder';
const NOTIF_ID_KEY = 'export_reminder_notif_id';
const ENABLED_KEY = 'export_reminder_enabled';
const ASKED_KEY = 'export_reminder_asked';

const FIFTEEN_DAYS_SECONDS = 15 * 24 * 60 * 60;

/**
 * A local schedule, not a push notification — this app has no server to send
 * from, and local notifications are unaffected by Expo Go's SDK 53+ removal
 * of remote push support, so this is fully testable without an EAS build.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const COPY = {
  en: {
    title: 'Back up GharKhata',
    body: 'It has been a while — export your data from Settings so nothing is lost.',
    channelName: 'Backup reminder',
  },
  hi: {
    title: 'GharKhata का बैकअप लें',
    body: 'काफ़ी दिन हो गए — Settings से डेटा एक्सपोर्ट कर लें ताकि कुछ खो न जाए।',
    channelName: 'बैकअप याद',
  },
};

function copy() {
  return getSetting('language') === 'hi' ? COPY.hi : COPY.en;
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: copy().channelName,
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export function isExportReminderEnabled(): boolean {
  return getSetting(ENABLED_KEY) === '1';
}

export function hasAskedExportReminder(): boolean {
  return getSetting(ASKED_KEY) === '1';
}

/**
 * Fires every 15 days on a fixed cadence starting from whenever it was last
 * (re)enabled — not "15 days since your last export", which would need the
 * app reopened to reset the clock. A steady nudge rather than a deadline.
 */
export async function enableExportReminder(): Promise<'granted' | 'denied'> {
  const perms = await Notifications.requestPermissionsAsync();
  if (perms.status !== 'granted') {
    setSetting(ENABLED_KEY, '0');
    return 'denied';
  }

  await ensureChannel();

  const existing = getSetting(NOTIF_ID_KEY);
  if (existing) {
    await Notifications.cancelScheduledNotificationAsync(existing).catch(() => {});
  }

  const { title, body } = copy();
  const id = await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: FIFTEEN_DAYS_SECONDS,
      repeats: true,
      channelId: CHANNEL_ID,
    },
  });

  setSetting(NOTIF_ID_KEY, id);
  setSetting(ENABLED_KEY, '1');
  return 'granted';
}

export async function disableExportReminder(): Promise<void> {
  const existing = getSetting(NOTIF_ID_KEY);
  if (existing) {
    await Notifications.cancelScheduledNotificationAsync(existing).catch(() => {});
  }
  setSetting(ENABLED_KEY, '0');
}

/**
 * Runs once ever, the first time Settings is opened — not on cold boot,
 * so the permission prompt appears in a context that explains itself
 * (a screen about data and backups) rather than surprising a first launch.
 */
export async function maybeAskExportReminder(): Promise<void> {
  if (hasAskedExportReminder()) return;
  setSetting(ASKED_KEY, '1');
  await enableExportReminder();
}
