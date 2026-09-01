import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getSetting, setSetting } from './db';

const CHANNEL_ID = 'export-reminder';
const NOTIF_ID_KEY = 'export_reminder_notif_id';
const ENABLED_KEY = 'export_reminder_enabled';
const ASKED_KEY = 'export_reminder_asked';

const DUE_CHANNEL_ID = 'due-reminder';
const DUE_NOTIF_ID_KEY = 'due_reminder_notif_id';
const DUE_ENABLED_KEY = 'due_reminder_enabled';

const FIFTEEN_DAYS_SECONDS = 15 * 24 * 60 * 60;
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

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

const DUE_COPY = {
  en: {
    title: 'Check pending salary',
    body: 'It has been a month — open Salary to check balances due and pay workers on time.',
    channelName: 'Salary due reminder',
  },
  hi: {
    title: 'बकाया तनख्वाह देखें',
    body: 'एक महीना हो गया — Salary खोलकर बकाया रकम देखें और समय पर भुगतान करें।',
    channelName: 'तनख्वाह याद',
  },
};

function copy() {
  return getSetting('language') === 'hi' ? COPY.hi : COPY.en;
}

function dueCopy() {
  return getSetting('language') === 'hi' ? DUE_COPY.hi : DUE_COPY.en;
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: copy().channelName,
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function ensureDueChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(DUE_CHANNEL_ID, {
    name: dueCopy().channelName,
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
 * Marks the first-ever ask as done without touching the OS permission at
 * all — used when the user declines the in-app "why enable this" prompt, so
 * Android's own permission dialog (denied at most once before it stops
 * appearing entirely) is never spent on someone who hasn't been told why
 * they'd want to say yes.
 */
export function skipExportReminderAsk(): void {
  setSetting(ASKED_KEY, '1');
}

/* ---------- salary due reminder ---------- */

/**
 * A static monthly nudge, not a live check of the current balance — local
 * notifications are scheduled ahead of time and cannot query SQLite right
 * before firing, so this can only say "go look", never "₹X is due". Opt-in
 * only: unlike the backup reminder, nothing turns this on automatically.
 */
export function isDueReminderEnabled(): boolean {
  return getSetting(DUE_ENABLED_KEY) === '1';
}

export async function enableDueReminder(): Promise<'granted' | 'denied'> {
  const perms = await Notifications.requestPermissionsAsync();
  if (perms.status !== 'granted') {
    setSetting(DUE_ENABLED_KEY, '0');
    return 'denied';
  }

  await ensureDueChannel();

  const existing = getSetting(DUE_NOTIF_ID_KEY);
  if (existing) {
    await Notifications.cancelScheduledNotificationAsync(existing).catch(() => {});
  }

  const { title, body } = dueCopy();
  const id = await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: THIRTY_DAYS_SECONDS,
      repeats: true,
      channelId: DUE_CHANNEL_ID,
    },
  });

  setSetting(DUE_NOTIF_ID_KEY, id);
  setSetting(DUE_ENABLED_KEY, '1');
  return 'granted';
}

export async function disableDueReminder(): Promise<void> {
  const existing = getSetting(DUE_NOTIF_ID_KEY);
  if (existing) {
    await Notifications.cancelScheduledNotificationAsync(existing).catch(() => {});
  }
  setSetting(DUE_ENABLED_KEY, '0');
}
