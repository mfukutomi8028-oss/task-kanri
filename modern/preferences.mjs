// Independent design preferences contract. No Firebase, task data, or Classic DOM imports.
// This module is NOT wired to the product entry point until the Modern core adapter is complete.
export const DESIGN_IDS = Object.freeze(['classic', 'modern']);
export const MODERN_PALETTES = Object.freeze([
  'ink', 'ocean', 'forest', 'plum',
  'mist', 'sage', 'apricot', 'lilac',
  'night', 'slate', 'charcoal', 'dusk'
]);
export const DEFAULT_DISPLAY = Object.freeze({ design: 'classic', palette: 'ink' });
const DESIGNS = new Set(DESIGN_IDS);
const PALETTES = new Set(MODERN_PALETTES);
const PREFIX = 'workboard-display-v1';

function validatedIdentity(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a nonempty string`);
  // User names currently identify the selected local profile, not authentication.
  return encodeURIComponent(value.trim());
}

export function displayPreferenceKey(roomId, selectedUser) {
  return `${PREFIX}:${validatedIdentity(roomId, 'roomId')}:${validatedIdentity(selectedUser, 'selectedUser')}`;
}

export function normalizeDisplayPreferences(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_DISPLAY };
  return {
    design: DESIGNS.has(raw.design) ? raw.design : DEFAULT_DISPLAY.design,
    palette: PALETTES.has(raw.palette) ? raw.palette : DEFAULT_DISPLAY.palette
  };
}

export function readDisplayPreferences(storage, roomId, selectedUser) {
  const key = displayPreferenceKey(roomId, selectedUser);
  if (!storage || typeof storage.getItem !== 'function') return { ...DEFAULT_DISPLAY };
  try {
    const serialized = storage.getItem(key);
    return serialized === null ? { ...DEFAULT_DISPLAY } : normalizeDisplayPreferences(JSON.parse(serialized));
  } catch {
    // Storage can be unavailable in private browsing or restricted browsers.
    return { ...DEFAULT_DISPLAY };
  }
}

export function writeDisplayPreferences(storage, roomId, selectedUser, next) {
  const key = displayPreferenceKey(roomId, selectedUser);
  const current = readDisplayPreferences(storage, roomId, selectedUser);
  // Update only supplied valid fields. Invalid values never overwrite a valid saved theme.
  const value = {
    design: DESIGNS.has(next?.design) ? next.design : current.design,
    palette: PALETTES.has(next?.palette) ? next.palette : current.palette
  };
  try {
    if (!storage || typeof storage.setItem !== 'function') return { value, persisted: false };
    storage.setItem(key, JSON.stringify(value));
    return { value, persisted: true };
  } catch {
    return { value, persisted: false };
  }
}
