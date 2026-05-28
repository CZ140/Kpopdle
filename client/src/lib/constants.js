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
  twice:       'TWICEDLE',
  newjeans:    'NEWJEANDLE',
  lesserafim:  'SERAFIDLE',
  aespa:       'AESPADLE',
  redvelvet:   'VELVETLE',
  kissoflife:  'KOLFDLE',
  ive:         'IVEDLE',
  blackpink:   'BPINKDLE',
  bts:         'BTSDLE',
  straykids:   'SKZDLE',
  seventeen:   'SVTDLE',
  gidle:       'GIDLEDLE',
  enhypen:     'ENHYDLE',
  ateez:       'ATEEZDLE',
  txt:         'TXTDLE',
  itzy:        'ITZYDLE',
  illit:       'ILLITDLE',
  nmixx:       'NMIXXDLE',
  exo:         'EXODLE',
  bigbang:     'BIGDLE',
  shinee:      'SHINEEDLE',
  mamamoo:     'MAMOODLE',
  snsd:        'SNSDDLE',
  babymonster: 'BABYDLE',
  riize:       'RIIZEDLE',
  boynextdoor: 'BNDDLE',
  tws:         'TWSDLE',
  zerobaseone: 'ZB1DLE',
  kpopdle:     'K-POPDLE',
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
  twice:       '2026-02-20',
  newjeans:    '2026-05-18',
  lesserafim:  '2026-05-18',
  aespa:       '2026-05-18',
  redvelvet:   '2026-05-18',
  kissoflife:  '2026-05-18',
  ive:         '2026-05-18',
  blackpink:   '2026-05-18',
  bts:         '2026-05-28',
  straykids:   '2026-05-28',
  seventeen:   '2026-05-28',
  gidle:       '2026-05-28',
  enhypen:     '2026-05-28',
  ateez:       '2026-05-28',
  txt:         '2026-05-28',
  itzy:        '2026-05-28',
  illit:       '2026-05-28',
  nmixx:       '2026-05-28',
  exo:         '2026-05-28',
  bigbang:     '2026-05-28',
  shinee:      '2026-05-28',
  mamamoo:     '2026-05-28',
  snsd:        '2026-05-28',
  babymonster: '2026-05-28',
  riize:       '2026-05-28',
  boynextdoor: '2026-05-28',
  tws:         '2026-05-28',
  zerobaseone: '2026-05-28',
  kpopdle:     '2026-05-21',
  'guess-the-group': '2026-05-27',
}

// Display names + taglines for per-route SEO titles/descriptions (see useDocumentMeta).
export const GROUP_META = {
  twice:       { displayName: 'TWICE',               tagline: 'Daily TWICE Song Quiz' },
  newjeans:    { displayName: 'NewJeans',            tagline: 'Daily NewJeans Song Quiz' },
  lesserafim:  { displayName: 'LE SSERAFIM',         tagline: 'Daily LE SSERAFIM Song Quiz' },
  aespa:       { displayName: 'aespa',               tagline: 'Daily aespa Song Quiz' },
  redvelvet:   { displayName: 'Red Velvet',          tagline: 'Daily Red Velvet Song Quiz' },
  kissoflife:  { displayName: 'KISS OF LIFE',        tagline: 'Daily KISS OF LIFE Song Quiz' },
  ive:         { displayName: 'IVE',                 tagline: 'Daily IVE Song Quiz' },
  blackpink:   { displayName: 'BLACKPINK',           tagline: 'Daily BLACKPINK Song Quiz' },
  bts:         { displayName: 'BTS',                 tagline: 'Daily BTS Song Quiz' },
  straykids:   { displayName: 'Stray Kids',          tagline: 'Daily Stray Kids Song Quiz' },
  seventeen:   { displayName: 'SEVENTEEN',           tagline: 'Daily SEVENTEEN Song Quiz' },
  gidle:       { displayName: '(G)I-DLE',            tagline: 'Daily (G)I-DLE Song Quiz' },
  enhypen:     { displayName: 'ENHYPEN',             tagline: 'Daily ENHYPEN Song Quiz' },
  ateez:       { displayName: 'ATEEZ',               tagline: 'Daily ATEEZ Song Quiz' },
  txt:         { displayName: 'TOMORROW X TOGETHER', tagline: 'Daily TXT Song Quiz' },
  itzy:        { displayName: 'ITZY',                tagline: 'Daily ITZY Song Quiz' },
  illit:       { displayName: 'ILLIT',               tagline: 'Daily ILLIT Song Quiz' },
  nmixx:       { displayName: 'NMIXX',               tagline: 'Daily NMIXX Song Quiz' },
  exo:         { displayName: 'EXO',                 tagline: 'Daily EXO Song Quiz' },
  bigbang:     { displayName: 'BIGBANG',             tagline: 'Daily BIGBANG Song Quiz' },
  shinee:      { displayName: 'SHINee',              tagline: 'Daily SHINee Song Quiz' },
  mamamoo:     { displayName: 'MAMAMOO',             tagline: 'Daily MAMAMOO Song Quiz' },
  snsd:        { displayName: "Girls' Generation",   tagline: "Daily Girls' Generation Song Quiz" },
  babymonster: { displayName: 'BABYMONSTER',         tagline: 'Daily BABYMONSTER Song Quiz' },
  riize:       { displayName: 'RIIZE',               tagline: 'Daily RIIZE Song Quiz' },
  boynextdoor: { displayName: 'BOYNEXTDOOR',         tagline: 'Daily BOYNEXTDOOR Song Quiz' },
  tws:         { displayName: 'TWS',                 tagline: 'Daily TWS Song Quiz' },
  zerobaseone: { displayName: 'ZEROBASEONE',         tagline: 'Daily ZEROBASEONE Song Quiz' },
}
