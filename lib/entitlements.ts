import {
  activeHelperCount,
  deactivateHelper,
  getSetting,
  listHelpers,
  reactivateHelper,
  setSetting,
} from './db';
import { currentPeriod, shiftPeriod } from './dates';

/**
 * Every tier gate in the app routes through this file, so switching the app
 * to a paid model later means wiring `isPremium()` to a real Play Billing
 * purchase check — no gate logic elsewhere has to change.
 *
 * Today there is no billing: the app ships free and `isPremium()` is always
 * false unless flipped locally. Note that this state lives in SQLite, so it
 * is an honest limit rather than a secure one; clearing app data resets it.
 */
const PREMIUM_KEY = 'premium_active';

/** Workers trackable without premium. */
export const FREE_HELPER_LIMIT = 2;

/** Months of past records browsable without premium, excluding this one. */
export const FREE_HISTORY_MONTHS = 2;

export function isPremium(): boolean {
  return getSetting(PREMIUM_KEY) === '1';
}

export function helperLimit(): number {
  return isPremium() ? Infinity : FREE_HELPER_LIMIT;
}

export function canAddHelper(): boolean {
  return activeHelperCount() < helperLimit();
}

/** Remaining slots on the free tier, for the "1 of 2 used" hint. */
export function remainingHelperSlots(): number {
  if (isPremium()) return Infinity;
  return Math.max(0, FREE_HELPER_LIMIT - activeHelperCount());
}

/* ---------- history window ---------- */

/** Oldest period the current tier may open. */
export function earliestVisiblePeriod(): string {
  if (isPremium()) return '0000-01';
  return shiftPeriod(currentPeriod(), -FREE_HISTORY_MONTHS);
}

export function canViewPeriod(period: string): boolean {
  return period >= earliestVisiblePeriod();
}

/* ---------- tier transitions ---------- */

/**
 * Applies the free-tier cap after premium ends: the two most recently added
 * workers stay active and everyone else is *deactivated*, not archived.
 *
 * The distinction matters. Archiving records that employment ended, which
 * truncates that worker's salary window. Deactivating only hides them from
 * the tier-limited screens and leaves every date and rupee intact, so
 * `restorePremiumAccess()` brings them back exactly as they were.
 */
export function enforceFreeTier(): number {
  if (isPremium()) return 0;

  const active = listHelpers();
  if (active.length <= FREE_HELPER_LIMIT) return 0;

  // listHelpers() sorts by name; order by recency so the newest hires are
  // the ones kept, matching what the user asked for.
  const byRecency = [...active].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );

  const toHide = byRecency.slice(FREE_HELPER_LIMIT);
  for (const helper of toHide) deactivateHelper(helper.id);
  return toHide.length;
}

/** Undoes enforceFreeTier() when premium is (re)activated. */
export function restorePremiumAccess(): void {
  for (const helper of listHelpers(true)) {
    // Only revive tier-hidden workers. Anyone genuinely archived because the
    // job ended stays archived.
    if (helper.is_active === 0 && helper.archived_at === null) {
      reactivateHelper(helper.id);
    }
  }
}

export function setPremium(active: boolean): void {
  setSetting(PREMIUM_KEY, active ? '1' : '0');
  if (active) {
    restorePremiumAccess();
  } else {
    enforceFreeTier();
  }
}

/** How many workers are currently hidden by the free-tier cap. */
export function tierHiddenCount(): number {
  return listHelpers(true).filter(
    (h) => h.is_active === 0 && h.archived_at === null,
  ).length;
}

/* ---------- backup / restore usage ---------- */

/**
 * Restore is not gated at all, on any plan — it is how someone gets their
 * own data back after losing a phone or reinstalling, not a growth feature,
 * so limiting it risks real, unrecoverable data loss for a free-tier user.
 * Only Export carries a soft monthly nudge toward premium.
 */
export const FREE_EXPORT_ACTIONS_PER_MONTH = 2;

// Keyed by month so the count resets on its own — nothing to schedule or
// clear, "this month" is just whatever currentPeriod() returns right now.
const exportUsageKey = (): string => `export_actions_${currentPeriod()}`;

export function exportActionsUsed(): number {
  return Number(getSetting(exportUsageKey()) ?? '0');
}

export function exportActionsRemaining(): number {
  if (isPremium()) return Infinity;
  return Math.max(0, FREE_EXPORT_ACTIONS_PER_MONTH - exportActionsUsed());
}

export function canExport(): boolean {
  return isPremium() || exportActionsRemaining() > 0;
}

/** Call once an export actually completes — not on cancel. */
export function recordExportUsed(): void {
  if (isPremium()) return;
  setSetting(exportUsageKey(), String(exportActionsUsed() + 1));
}
