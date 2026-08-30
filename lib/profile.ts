import { getSetting, setSetting } from './db';

export interface OwnerProfile {
  name: string;
  phone: string;
  email: string;
}

const EMPTY_PROFILE: OwnerProfile = { name: '', phone: '', email: '' };

/**
 * The household's own details, not a worker's — stored as plain settings
 * rows so it rides along with the existing backup/restore flow for free,
 * with no schema change needed.
 */
export function getOwnerProfile(): OwnerProfile {
  return {
    name: getSetting('profile_name') ?? EMPTY_PROFILE.name,
    phone: getSetting('profile_phone') ?? EMPTY_PROFILE.phone,
    email: getSetting('profile_email') ?? EMPTY_PROFILE.email,
  };
}

export function saveOwnerProfile(profile: OwnerProfile): void {
  setSetting('profile_name', profile.name);
  setSetting('profile_phone', profile.phone);
  setSetting('profile_email', profile.email);
}
