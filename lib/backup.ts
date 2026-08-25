import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { BackupPayload, exportAllData, importAllData } from './db';
import { todayKey } from './dates';

function isBackupPayload(value: unknown): value is BackupPayload {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    Array.isArray(v.helpers) &&
    Array.isArray(v.attendance) &&
    Array.isArray(v.ledgerEntries) &&
    Array.isArray(v.payments)
  );
}

/**
 * Writes the whole database to a JSON file in the cache directory and hands
 * it to the system share sheet — WhatsApp, Drive, email, whatever the user
 * picks. The file is a snapshot, not a live sync: nothing keeps it updated.
 */
export async function exportBackupFile(): Promise<void> {
  const payload = exportAllData();
  const file = new File(Paths.cache, `gharkhata-backup-${todayKey()}.json`);
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
