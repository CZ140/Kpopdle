import crypto from 'crypto'
import { getAllSongs } from '../data/songIndex.js'
import { getKSTDateString, getGameNumber } from '../utils/dateUtils.js'

if (!process.env.DAILY_SONG_SECRET) {
  console.warn('[twicedle] DAILY_SONG_SECRET is not set — using insecure default. Set this in production.')
}
const SECRET = process.env.DAILY_SONG_SECRET || 'twicedle-default-secret'

function getDailySongIndex(songCount, dateString) {
  const hash = crypto.createHmac('sha256', SECRET)
    .update(dateString)
    .digest('hex')

  return parseInt(hash.substring(0, 8), 16) % songCount
}

export function getTodaysSong() {
  const songs = getAllSongs()
  const dateString = getKSTDateString()
  const index = getDailySongIndex(songs.length, dateString)
  const gameNumber = getGameNumber(dateString)

  return {
    song: songs[index],
    dateString,
    gameNumber,
  }
}
