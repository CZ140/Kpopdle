export const DIFFICULTIES = {
  easy:   [3, 5, 8, 10, 12, 15],
  normal: [1, 2, 3, 4, 5, 6],
  hard:   [0.5, 1, 1.5, 2, 3, 4],
}

export const SNIPPET_DURATIONS = DIFFICULTIES.normal
export const MAX_GUESSES = 6

// Per-mode attempt caps. The daily song games use MAX_GUESSES (6); "Guess the
// Group" uses a tighter 3-attempt ladder since the answer space is only ~8 names.
// Threaded through GroupContext (useMaxGuesses) so useGame / audio / share /
// GuessList all agree without a global edit.
export const GUESS_GROUP_MAX_GUESSES = 3

export const GAME_STATES = {
  PLAYING: 'playing',
  WON: 'won',
  LOST: 'lost',
}

export const GAME_NAMES = {
  twice:      'TWICEDLE',
  newjeans:   'NEWJEANDLE',
  lesserafim: 'SERAFIDLE',
  aespa:      'AESPADLE',
  redvelvet:  'VELVETLE',
  kissoflife: 'KOLFDLE',
  ive:        'IVEDLE',
  blackpink:  'BPINKDLE',
  kpopdle:    'K-POPDLE',
}

// Share-header name for the "Guess the Group" mode. Kept out of GAME_NAMES so it
// doesn't leak into ALL_GROUP_IDS (which drives per-group stats/account rows).
export const GUESS_GROUP_GAME_NAME = 'Guess the Group'

// Single source of truth for all group IDs — update here when adding a new group
export const ALL_GROUP_IDS = Object.keys(GAME_NAMES)

// Launch dates per game — single client-side source of truth (was duplicated
// across GroupPage + KpopdlePage). Mirrors the server: per-group dates come from
// groups.json `launchDate`, and `kpopdle` from server/src/data/launch.js.
// scripts/validate-constants.js fails CI if these drift from the server.
export const LAUNCH_DATES = {
  twice:      '2026-02-20',
  newjeans:   '2026-05-18',
  lesserafim: '2026-05-18',
  aespa:      '2026-05-18',
  redvelvet:  '2026-05-18',
  kissoflife: '2026-05-18',
  ive:        '2026-05-18',
  blackpink:  '2026-05-18',
  kpopdle:    '2026-05-21',
  'guess-the-group': '2026-05-27',
}

// Display names + taglines for per-route SEO titles/descriptions (see useDocumentMeta).
export const GROUP_META = {
  twice:      { displayName: 'TWICE',        tagline: 'Daily TWICE Song Quiz' },
  newjeans:   { displayName: 'NewJeans',     tagline: 'Daily NewJeans Song Quiz' },
  lesserafim: { displayName: 'LE SSERAFIM',  tagline: 'Daily LE SSERAFIM Song Quiz' },
  aespa:      { displayName: 'aespa',        tagline: 'Daily aespa Song Quiz' },
  redvelvet:  { displayName: 'Red Velvet',   tagline: 'Daily Red Velvet Song Quiz' },
  kissoflife: { displayName: 'KISS OF LIFE', tagline: 'Daily KISS OF LIFE Song Quiz' },
  ive:        { displayName: 'IVE',          tagline: 'Daily IVE Song Quiz' },
  blackpink:  { displayName: 'BLACKPINK',    tagline: 'Daily BLACKPINK Song Quiz' },
}
