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
