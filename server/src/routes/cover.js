import { Router } from 'express'
import { getTodaysCoverAlbum, getCoverAlbumForDate } from '../services/dailySong.js'
import { getCoverAlbumPoolForGroup } from '../data/songIndex.js'
import { getKSTDateString } from '../utils/dateUtils.js'
import validateGroup from '../middleware/validateGroup.js'
import { getCommunityStats } from '../services/statsDb.js'
import { captureError } from '../services/observability.js'

// Coverdle mode — mirrors routes/game.js but the answer is the ALBUM the cover
// belongs to (not a song on that album). Most album covers are shared by 5+
// tracks, so a song-level answer made the puzzle degenerate into "guess which
// song on this EP today's coin flip picked." Albums are the natural answer
// space for "guess the cover." Only albums with a backfilled coverUrl (and at
// least one Deezer-verified track) are selectable.
const router = Router({ mergeParams: true })

// dailySong throws this exact message when a group has no playable covers yet.
// That's an expected "not provisioned" state, not a server fault — we map it to
// a clean 404 so it doesn't spam error monitoring.
const NO_COVERS_RE = /^No songs with album covers available for group:/
const NO_COVERS_BODY = { error: 'No album covers available for this group yet' }

router.use(validateGroup)

// Hints for the album-answer Coverdle:
//   1. releaseYear — when did this album drop
//   2. trackCount — how many songs are on the album
//   3. firstLetter — first character of the album name
// `era` (= album name) was the first hint in song-mode but is now the answer,
// so we drop it. firstLetter likewise now points at the album, not a song.
function hintsForAlbum(album) {
  return {
    year: album.releaseYear,
    trackCount: album.songs.length,
    firstLetter: album.album[0].toUpperCase(),
  }
}

router.get('/today', (req, res) => {
  const { group } = req.params
  try {
    const { album, dateString, gameNumber } = getTodaysCoverAlbum(group)

    // Identical for every player for the day, and coverUrl is a stable CDN URL
    // (no short expiry like audio previews) — safe to cache briefly at the CDN.
    res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=30')
    res.json({
      gameDate: dateString,
      gameNumber,
      coverUrl: album.coverUrl,
      totalSongs: getCoverAlbumPoolForGroup(group).length,
      hints: hintsForAlbum(album),
    })
  } catch (err) {
    if (NO_COVERS_RE.test(err.message)) {
      return res.status(404).json(NO_COVERS_BODY)
    }
    captureError(err, { msg: 'Error fetching daily cover game', group })
    res.status(500).json({ error: 'Failed to load daily cover game' })
  }
})

router.get('/archive/:date', (req, res) => {
  const { group, date } = req.params

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' })
  }

  const today = getKSTDateString()
  if (date >= today) {
    return res.status(400).json({ error: 'Archive only available for past games' })
  }

  const launchDate = req.groupConfig.launchDate
  if (launchDate && date < launchDate) {
    return res.status(400).json({ error: 'Date is before group launch' })
  }

  try {
    const { album, dateString, gameNumber } = getCoverAlbumForDate(group, date)

    res.json({
      gameDate: dateString,
      gameNumber,
      coverUrl: album.coverUrl,
      totalSongs: getCoverAlbumPoolForGroup(group).length,
      hints: hintsForAlbum(album),
    })
  } catch (err) {
    if (NO_COVERS_RE.test(err.message)) {
      return res.status(404).json(NO_COVERS_BODY)
    }
    captureError(err, { msg: 'Error fetching archive cover game', group, date })
    res.status(500).json({ error: 'Failed to load archive cover game' })
  }
})

router.get('/practice', (req, res) => {
  const { group } = req.params
  try {
    const albums = getCoverAlbumPoolForGroup(group)
    if (albums.length === 0) {
      return res.status(404).json(NO_COVERS_BODY)
    }
    const idx = Math.floor(Math.random() * albums.length)
    const album = albums[idx]
    res.json({
      coverUrl: album.coverUrl,
      totalSongs: albums.length,
      // Index into the deduped album pool — the client echoes this back on each
      // guess so we can validate against the exact album that was served (the
      // pool is built deterministically from songs.json, so the index is stable
      // for the lifetime of a deploy).
      practiceAlbumIndex: idx,
      hints: hintsForAlbum(album),
    })
  } catch (err) {
    captureError(err, { msg: 'Error fetching practice cover game', group })
    res.status(500).json({ error: 'Failed to load practice cover game' })
  }
})

// Album autocomplete — same response shape as /:group/songs (`{songs: [...]}`)
// so the existing useSongList hook can consume it without a new branch.
router.get('/albums-list', (req, res) => {
  const { group } = req.params
  try {
    const albums = getCoverAlbumPoolForGroup(group)
    res.json({ songs: albums.map(a => a.album) })
  } catch (err) {
    captureError(err, { msg: 'Error fetching album list', group })
    res.status(500).json({ error: 'Failed to load album list' })
  }
})

function albumPayload(album) {
  return {
    album: album.album,
    releaseYear: album.releaseYear,
    coverUrl: album.coverUrl,
    tracks: album.songs.map(s => s.title),
  }
}

router.post('/guess', (req, res) => {
  const { group } = req.params
  try {
    const { gameDate, guess, practiceAlbumIndex } = req.body

    // Practice mode: validate against the specific album sent with the request
    if (gameDate === 'practice') {
      if (typeof practiceAlbumIndex !== 'number') {
        return res.status(400).json({ error: 'practiceAlbumIndex required for practice mode' })
      }
      const albums = getCoverAlbumPoolForGroup(group)
      const album = albums[practiceAlbumIndex]
      if (!album) {
        return res.status(400).json({ error: 'Invalid practice album' })
      }
      const payload = albumPayload(album)
      if (!guess || guess.trim() === '') {
        return res.json({ correct: false, gameOver: true, album: payload })
      }
      const isCorrect = guess.trim().toLowerCase() === album.album.toLowerCase()
      return res.json({ correct: isCorrect, gameOver: isCorrect, ...(isCorrect && { album: payload }) })
    }

    if (!gameDate || typeof gameDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) {
      return res.status(400).json({ error: 'gameDate is required (YYYY-MM-DD)' })
    }

    if (guess !== undefined && (typeof guess !== 'string' || guess.length > 200)) {
      return res.status(400).json({ error: 'Invalid guess' })
    }

    // Guard against future dates
    const today = getKSTDateString()
    if (gameDate > today) {
      return res.status(400).json({ error: 'Cannot guess future games' })
    }

    // Works for today and any past archive date
    const { album } = getCoverAlbumForDate(group, gameDate)

    if (!guess || guess.trim() === '') {
      return res.json({
        correct: false,
        gameOver: true,
        album: albumPayload(album),
      })
    }

    const isCorrect = guess.trim().toLowerCase() === album.album.toLowerCase()

    // Only reveal the answer when the game is over — not on intermediate wrong guesses
    res.json({
      correct: isCorrect,
      gameOver: isCorrect,
      ...(isCorrect && { album: albumPayload(album) }),
    })
  } catch (err) {
    captureError(err, { msg: 'Error processing cover guess', group })
    res.status(500).json({ error: 'Failed to process guess' })
  }
})

router.get('/community/:date', (req, res) => {
  const { group, date } = req.params
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format' })
  }
  try {
    // Cover-mode community stats live under a `${group}-cover` key so they never
    // pollute the audio daily's stats (FR-7).
    res.json(getCommunityStats(`${group}-cover`, date) ?? { totalPlays: 0 })
  } catch (err) {
    captureError(err, { msg: 'Cover community stats error', group, date })
    res.status(500).json({ error: 'Failed to fetch community stats' })
  }
})

export default router
