import crypto from 'crypto'
import { getMergedPool, getSongsForGroup } from '../data/songIndex.js'
import groups from '../data/groups.json' with { type: 'json' }

// Picks the songs for a Battle match. Reuses the daily game's catalog + pools.
// Battle is ad-hoc (not date-deterministic), so selection is random per match.

const ACTIVE_GROUPS = groups.filter((g) => g.active)
const GROUP_BY_ID = new Map(groups.map((g) => [g.id, g]))

const playable = (songs) => songs.filter((s) => s.deezerId && s.deezerId !== 0)

/**
 * Enriched, playable-only song pool for a scope.
 * 'all' -> cross-group merged pool (already enriched + filtered + memoized).
 * a groupId -> that group's songs, enriched to the merged-pool shape.
 */
export function poolForScope(scope) {
  if (scope === 'all') return getMergedPool(ACTIVE_GROUPS)
  const group = GROUP_BY_ID.get(scope)
  if (!group) throw new Error(`Unknown battle scope: ${scope}`)
  return playable(getSongsForGroup(scope)).map((s) => ({
    ...s,
    groupId: group.id,
    groupDisplayName: group.displayName,
    deezerArtistName: group.deezerArtistName,
  }))
}

function shuffle(arr) {
  // Fisher-Yates on a copy — never mutate the memoized merged pool.
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * `count` distinct songs for a match, each with an unguessable single-use clip
 * token (the opaque handle the audio proxy serves under — never the song id).
 */
export function selectRounds(scope, count = 5) {
  const pool = poolForScope(scope)
  if (pool.length === 0) throw new Error(`No playable songs for scope: ${scope}`)
  const n = Math.min(count, pool.length)
  return shuffle(pool)
    .slice(0, n)
    .map((song) => ({ song, clipToken: crypto.randomBytes(12).toString('base64url') }))
}
