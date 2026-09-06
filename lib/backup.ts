import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { BackupPayload, exportAllData, importAllData, setSetting, updateHelper } from './db';
import { todayKey } from './dates';
import { readPhotoBase64, savePhotoFromBase64 } from './photos';

const PROFILE_PHOTO_KEY = 'profile_photo_uri';

/**
 * A helper's or the owner's photo_uri is just a path into this device's own
 * storage — restoring the raw JSON on a different phone (or after this
 * one's storage was cleared) would leave every photo dangling, pointing at
 * a file that was never brought along. `photos` carries the actual bytes,
 * keyed by whatever photo_uri they were saved under, so a restore can write
 * them back out and repoint the rows at wherever they land on this device.
 */
interface FullBackupPayload extends BackupPayload {
  photos?: Record<string, string>;
}

// snapshots/settings/photos are optional on the payload, but if present
// must still be the right shape — otherwise a malformed value would only
// fail once import.ts tries to iterate it, deep inside a DB transaction.
const isArrayOrAbsent = (v: unknown): boolean => v === undefined || Array.isArray(v);
const isPlainObjectOrAbsent = (v: unknown): boolean =>
  v === undefined || (typeof v === 'object' && v !== null && !Array.isArray(v));

function isBackupPayload(value: unknown): value is FullBackupPayload {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    Array.isArray(v.helpers) &&
    Array.isArray(v.attendance) &&
    Array.isArray(v.ledgerEntries) &&
    Array.isArray(v.payments) &&
    isArrayOrAbsent(v.snapshots) &&
    isArrayOrAbsent(v.settings) &&
    isPlainObjectOrAbsent(v.photos)
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

  const photoUris = new Set<string>();
  for (const h of payload.helpers) if (h.photo_uri) photoUris.add(h.photo_uri);
  const profilePhotoUri = (payload.settings ?? []).find(
    (s) => s.key === PROFILE_PHOTO_KEY,
  )?.value;
  if (profilePhotoUri) photoUris.add(profilePhotoUri);

  const photos: Record<string, string> = {};
  for (const uri of photoUris) {
    const base64 = readPhotoBase64(uri);
    if (base64) photos[uri] = base64;
  }

  const fullPayload: FullBackupPayload = { ...payload, photos };
  const fileName = `GharKhata_Backup_${todayKey()}.json`;
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(fullPayload));

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

  // The rows just restored still carry whatever device's photo paths they
  // were exported with — meaningless here. Write each embedded photo into
  // this device's own storage and repoint the rows that referenced it.
  const uriMap = new Map<string, string>();
  for (const [oldUri, base64] of Object.entries(parsed.photos ?? {})) {
    try {
      uriMap.set(oldUri, savePhotoFromBase64(base64));
    } catch {
      // Skip a photo that fails to decode/write rather than failing the
      // whole restore over one bad image.
    }
  }
  if (uriMap.size > 0) {
    for (const h of parsed.helpers) {
      const newUri = h.photo_uri ? uriMap.get(h.photo_uri) : undefined;
      if (newUri) updateHelper(h.id, { photo_uri: newUri });
    }
    const oldProfileUri = (parsed.settings ?? []).find(
      (s) => s.key === PROFILE_PHOTO_KEY,
    )?.value;
    const newProfileUri = oldProfileUri ? uriMap.get(oldProfileUri) : undefined;
    if (newProfileUri) setSetting(PROFILE_PHOTO_KEY, newProfileUri);
  }

  return { status: 'restored', helperCount: parsed.helpers.length };
}
