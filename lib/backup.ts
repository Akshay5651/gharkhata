import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { BackupPayload, exportAllData, importAllData } from './db';
import { todayKey } from './dates';

// snapshots/settings are optional on the payload, but if present must still
// be arrays — otherwise a malformed value would only fail once import.ts
// tries to iterate it, deep inside a DB transaction.
const isArrayOrAbsent = (v: unknown): boolean => v === undefined || Array.isArray(v);

function isBackupPayload(value: unknown): value is BackupPayload {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    Array.isArray(v.helpers) &&
    Array.isArray(v.attendance) &&
    Array.isArray(v.ledgerEntries) &&
    Array.isArray(v.payments) &&
    isArrayOrAbsent(v.snapshots) &&
    isArrayOrAbsent(v.settings)
  );
}

export type ExportOutcome = { status: 'cancelled' } | { status: 'saved'; fileName: string };

/**
 * Writes the whole database to a JSON file in the app's own cache directory
 * and hands it to the system share sheet — "Save to device" from there still
 * lets the user pick any folder, just through Android's own well-tested
 * document-tree flow. A direct pickDirectoryAsync() + File.create() attempt
 * was tried first but failed unpredictably across devices/providers with a
 * spurious "already exists" error even against a freshly created, empty
 * folder — not something diagnosable without device logs, so this reverts
 * to the flow that was already proven to work.
 *
 * Android never reports back which folder the user actually picked in the
 * share sheet, so the filename is the one thing worth surfacing back to
 * them afterward — it's what they'll look for, wherever they saved it.
 */
export async function exportBackupFile(): Promise<ExportOutcome> {
  const payload = exportAllData();
  const fileName = `GharKhata_Backup_${todayKey()}.json`;
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(payload));

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('sharing-unavailable');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'GharKhata backup',
  });
  return { status: 'saved', fileName };
}

export type ImportOutcome =
  | { status: 'cancelled' }
  | { status: 'invalid' }
  | { status: 'restored'; helperCount: number };

/**
 * Picks a .json file, validates its shape, and replaces the entire local
 * database with its contents. The caller is responsible for confirming this
 * with the user first — this function does not ask, it just does it.
 */
export async function importBackupFile(): Promise<ImportOutcome> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || result.assets.length === 0) {
    return { status: 'cancelled' };
  }

  const file = new File(result.assets[0].uri);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return { status: 'invalid' };
  }
  if (!isBackupPayload(parsed)) {
    return { status: 'invalid' };
  }

  importAllData(parsed);
  return { status: 'restored', helperCount: parsed.helpers.length };
}
