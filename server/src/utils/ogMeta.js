// Social crawlers (Discord, Twitter, iMessage) don't run the SPA, so a shared
// /twice link would otherwise unfurl as the generic homepage card. For the
// per-group routes we rewrite the static OG/Twitter tags in index.html on the
// server before sending it. Output is memoised per path.

const SITE = 'https://k-popdle.com'
const ROUTE = /^\/([a-z0-9]+)(\/cover)?\/?$/
const cache = new Map()

const escape = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

function setTag(html, attr, key, value) {
  const re = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`)
  return html.replace(re, `$1${escape(value)}$2`)
}

export function renderIndexForPath(indexHtml, path, groups) {
  const m = ROUTE.exec(path)
  const group = m && groups.find(g => g.active && g.id === m[1])
  if (!group) return indexHtml
  if (cache.has(path)) return cache.get(path)

  const isCover = !!m[2]
  const title = isCover
    ? `${group.displayName} Coverdle — Guess the album cover`
    : `${group.gameName} — Daily ${group.displayName} Song Quiz`
  const description = isCover
    ? `Guess today's ${group.displayName} album from a pixelated cover. A new one every day at midnight KST.`
    : `Listen to a clip and guess the ${group.displayName} song in 6 tries. A new song every day at midnight KST.`
  const image = `${SITE}/og/${group.id}.jpg`
  const url = `${SITE}/${group.id}${isCover ? '/cover' : ''}`

  let html = indexHtml.replace(/<title>[^<]*<\/title>/, `<title>${escape(title)}</title>`)
  html = setTag(html, 'property', 'og:title', title)
  html = setTag(html, 'property', 'og:description', description)
  html = setTag(html, 'property', 'og:image', image)
  html = setTag(html, 'property', 'og:image:alt', `${group.gameName} — ${group.displayName} daily song quiz`)
  html = setTag(html, 'name', 'twitter:title', title)
  html = setTag(html, 'name', 'twitter:description', description)
  html = setTag(html, 'name', 'twitter:image', image)
  html = setTag(html, 'name', 'description', description)
  html = html.replace('</head>', `<meta property="og:url" content="${url}" /></head>`)

  cache.set(path, html)
  return html
}
