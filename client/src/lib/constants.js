export const DIFFICULTIES = {
  easy:   [3, 5, 8, 10, 12, 15],
  normal: [1, 2, 3, 4, 5, 6],
  hard:   [0.5, 1, 1.5, 2, 3, 4],
}

export const SNIPPET_DURATIONS = DIFFICULTIES.normal
export const MAX_GUESSES = 6

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

// Single source of truth for all group IDs — update here when adding a new group
export const ALL_GROUP_IDS = Object.keys(GAME_NAMES)

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
