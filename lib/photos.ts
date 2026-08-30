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
