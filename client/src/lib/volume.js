// Shared playback-volume preference, persisted across the daily game and Battle
// so a player's choice carries everywhere. (Extracted from useAudioPlayer.)
const VOLUME_KEY = 'kpopdle-volume'
const DEFAULT_VOLUME = 0.8

export function getSavedVolume() {
  try {
    const v = parseFloat(localStorage.getItem(VOLUME_KEY))
    return isNaN(v) ? DEFAULT_VOLUME : Math.min(1, Math.max(0, v))
  } catch {
    return DEFAULT_VOLUME
  }
}

export function saveVolume(v) {
  const clamped = Math.min(1, Math.max(0, v))
  try { localStorage.setItem(VOLUME_KEY, String(clamped)) } catch {}
  return clamped
}
