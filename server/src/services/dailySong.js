import crypto from 'crypto'
import { getSongsForGroup } from '../data/songIndex.js'
import { getKSTDateString, getGameNumber } from '../utils/dateUtils.js'

if (!process.env.DAILY_SONG_SECRET) {
  console.warn('[twicedle] DAILY_SONG_SECRET is not set — using insecure default. Set this in production.')
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

export function getSongForDate(groupId, dateString) {
  const songs = getSongsForGroup(groupId)
  const index = getDailySongIndex(songs.length, dateString, groupId)
  const gameNumber = getGameNumber(dateString)

  return {
    song: songs[index],
    dateString,
    gameNumber,
  }
}
