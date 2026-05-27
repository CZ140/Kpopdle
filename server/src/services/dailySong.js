import crypto from 'crypto'
import { getSongsForGroup, getMergedPool } from '../data/songIndex.js'
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
