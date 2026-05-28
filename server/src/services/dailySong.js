import crypto from 'crypto'
import { getSongsForGroup, getMergedPool, getCoverAlbumPoolForGroup } from '../data/songIndex.js'
import { getKSTDateString, getGameNumber } from '../utils/dateUtils.js'
import { KPOPDLE_LAUNCH, GUESS_GROUP_LAUNCH } from '../data/launch.js'
import { logger } from './observability.js'

if (!process.env.DAILY_SONG_SECRET) {
  logger.warn('DAILY_SONG_SECRET is not set — using insecure default. Set this in production.')
}
const BASE_SECRET = process.env.DAILY_SONG_SECRET || 'twicedle-default-secret'

function getDailySongIndex(songCount, dateString, groupId) {
  const secret = `${BASE_SECRET}-${groupId}`
  const hash = crypto.createHmac('sha256', secret)
    .update(dateString)
    .digest('hex')
  return parseInt(hash.substring(0, 8), 16) % songCount
}

// Cover mode uses a distinct secret suffix so the cover-of-the-day is chosen
// independently of the audio daily — same date/group yields a stable pick that
// generally differs from the audio song (FR-3).
function getDailyCoverIndex(songCount, dateString, groupId) {
  const secret = `${BASE_SECRET}-${groupId}-cover`
  const hash = crypto.createHmac('sha256', secret)
    .update(dateString)
    .digest('hex')
  return parseInt(hash.substring(0, 8), 16) % songCount
}

export function getTodaysSong(groupId) {
  return getSongForDate(groupId, getKSTDateString())
}

export function getKpopdleSongForDate(activeGroups, dateString) {
  const pool = getMergedPool(activeGroups)
  if (pool.length === 0) throw new Error('No kpopdle songs available')

  const secret = `${BASE_SECRET}-kpopdle`
  const hash = crypto.createHmac('sha256', secret).update(dateString).digest('hex')
  const index = parseInt(hash.substring(0, 8), 16) % pool.length

  const launch = new Date(KPOPDLE_LAUNCH + 'T00:00:00Z')
  const current = new Date(dateString + 'T00:00:00Z')
  const gameNumber = Math.max(1, Math.floor((current - launch) / 86400000) + 1)

  return { song: pool[index], poolSize: pool.length, dateString, gameNumber }
}

// Cross-group daily for the "Guess the Group" game. Mirrors getKpopdleSongForDate
// but uses a DISTINCT secret salt so it almost never lands on the same song as
// K-POPDLE on a given day, and numbers from GUESS_GROUP_LAUNCH.
export function getGuessGroupSongForDate(activeGroups, dateString) {
  const pool = getMergedPool(activeGroups)
  if (pool.length === 0) throw new Error('No guess-the-group songs available')

  const secret = `${BASE_SECRET}-guessgroup`
  const hash = crypto.createHmac('sha256', secret).update(dateString).digest('hex')
  const index = parseInt(hash.substring(0, 8), 16) % pool.length

  const launch = new Date(GUESS_GROUP_LAUNCH + 'T00:00:00Z')
  const current = new Date(dateString + 'T00:00:00Z')
  const gameNumber = Math.max(1, Math.floor((current - launch) / 86400000) + 1)

  return { song: pool[index], poolSize: pool.length, dateString, gameNumber }
}

export function getSongForDate(groupId, dateString) {
  const allSongs = getSongsForGroup(groupId)
  // Only rotate through songs that have a verified Deezer ID — ensures audio always plays
  const songs = allSongs.filter(s => s.deezerId && s.deezerId !== 0)
  if (songs.length === 0) {
    throw new Error(`No songs with Deezer previews available for group: ${groupId}`)
  }
  const index = getDailySongIndex(songs.length, dateString, groupId)
  const gameNumber = getGameNumber(dateString)

  return {
    song: songs[index],
    dateString,
    gameNumber,
  }
}

export function getTodaysCoverSong(groupId) {
  return getCoverSongForDate(groupId, getKSTDateString())
}

// Cover-mode daily: only songs that have a backfilled coverUrl are selectable
// (FR-8). Uses the -cover HMAC suffix so the pick is independent of the audio
// daily (FR-3).
export function getCoverSongForDate(groupId, dateString) {
  const allSongs = getSongsForGroup(groupId)
  const songs = allSongs.filter(s => s.deezerId && s.deezerId !== 0 && s.coverUrl)
  if (songs.length === 0) {
    throw new Error(`No songs with album covers available for group: ${groupId}`)
  }
  const index = getDailyCoverIndex(songs.length, dateString, groupId)
  const gameNumber = getGameNumber(dateString)

  return {
    song: songs[index],
    dateString,
    gameNumber,
  }
}

export function getTodaysCoverAlbum(groupId) {
  return getCoverAlbumForDate(groupId, getKSTDateString())
}

// Cover-mode daily, album edition — the actual answer space for Coverdle.
// Songs sharing an album collapse to one entry, so the puzzle stops degenerating
// into "which song on this EP did the coin flip pick today" when an EP cover is
// shared by 5+ tracks. Uses the same -cover HMAC suffix as the song-level helper
// so the pool *size* changes today but determinism per (group, date) is intact.
export function getCoverAlbumForDate(groupId, dateString) {
  const albums = getCoverAlbumPoolForGroup(groupId)
  if (albums.length === 0) {
    throw new Error(`No songs with album covers available for group: ${groupId}`)
  }
  const index = getDailyCoverIndex(albums.length, dateString, groupId)
  const gameNumber = getGameNumber(dateString)

  return {
    album: albums[index],
    dateString,
    gameNumber,
  }
}
