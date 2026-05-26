// Formatting helpers for the admin dashboard. Kept separate from charts.jsx so
// that file can export only components (React Fast Refresh requirement).

export const fmtNum = (n) => {
  if (n == null) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(n)
}

export const fmtMs = (ms) => (ms >= 1000 ? (ms / 1000).toFixed(2) + 's' : Math.round(ms) + 'ms')

export const COUNTRY_FLAG = (cc) => {
  if (!cc || cc.length !== 2 || cc === '??') return '🏳️'
  return String.fromCodePoint(...[...cc.toUpperCase()].map(c => 0x1f1a5 + c.charCodeAt(0)))
}
