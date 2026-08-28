import { describe, it, expect } from 'vitest'
import { renderIndexForPath } from './ogMeta.js'

const index = `<html><head><title>K-POPDLE</title>
<meta property="og:title" content="K-POPDLE" />
<meta property="og:image" content="https://k-popdle.com/og-image.png" />
<meta name="twitter:image" content="https://k-popdle.com/og-image.png" />
</head><body></body></html>`

const groups = [
  { id: 'twice', displayName: 'TWICE', gameName: 'TWICEDLE', active: true },
  { id: 'hidden', displayName: 'Hidden', gameName: 'HIDDLE', active: false },
]

describe('renderIndexForPath', () => {
  it('rewrites OG tags for an active group route', () => {
    const html = renderIndexForPath(index, '/twice', groups)
    expect(html).toContain('<title>TWICEDLE — Daily TWICE Song Quiz</title>')
    expect(html).toContain('content="https://k-popdle.com/og/twice.jpg"')
    expect(html).toContain('<meta property="og:url" content="https://k-popdle.com/twice" />')
    expect(html).not.toContain('og-image.png')
  })

  it('handles the cover route', () => {
    const html = renderIndexForPath(index, '/twice/cover', groups)
    expect(html).toContain('Coverdle')
    expect(html).toContain('content="https://k-popdle.com/twice/cover"')
  })

  it('leaves unknown, inactive, and non-group paths untouched', () => {
    for (const p of ['/', '/kpopdle', '/hidden', '/twice/cover/extra', '/battle/abc']) {
      expect(renderIndexForPath(index, p, groups)).toBe(index)
    }
  })
})
