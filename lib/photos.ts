import { Directory, File, Paths } from 'expo-file-system';

const PHOTOS_DIR = new Directory(Paths.document, 'photos');

/**
 * Image picker hands back a cache URI that the OS can evict at any time, so
 * a picked photo has to be copied into the app's own document directory to
 * survive past the current session — same reasoning as the backup file, just
 * the opposite direction (in, not out).
 */
export function savePhoto(sourceUri: string): string {
  if (!PHOTOS_DIR.exists) PHOTOS_DIR.create({ intermediates: true });
  const dest = new File(PHOTOS_DIR, `${Date.now()}-${Math.round(Math.random() * 1e6)}.jpg`);
  new File(sourceUri).copy(dest);
  return dest.uri;
}

/**
 * A backup's photo_uri values are just paths, meaningless once restored on
 * a different device or after this one's storage was wiped — the actual
 * bytes have to travel inside the backup file itself. Reads a saved photo
 * back out as base64 for that; returns null rather than throwing so one
 * unreadable photo doesn't fail an entire export.
 */
export function readPhotoBase64(uri: string): string | null {
  try {
    const file = new File(uri);
    return file.exists ? file.base64Sync() : null;
  } catch {
    return null;
  }
}

/** The write-back half of readPhotoBase64 — used when restoring a backup. */
export function savePhotoFromBase64(base64: string): string {
  if (!PHOTOS_DIR.exists) PHOTOS_DIR.create({ intermediates: true });
  const dest = new File(PHOTOS_DIR, `${Date.now()}-${Math.round(Math.random() * 1e6)}.jpg`);
  dest.create();
  dest.write(base64, { encoding: 'base64' });
  return dest.uri;
}
