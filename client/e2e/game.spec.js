import { test, expect } from '@playwright/test'

// All API responses are mocked, so these tests need no server/DB/Deezer.
const SONGS = ['Like Ooh-Ahh', 'TT', 'Fancy', 'Cheer Up', 'What Is Love?', 'Feel Special']
const ANSWER = 'TT'
const GROUP = {
  id: 'twice', displayName: 'TWICE', gameName: 'TWICEDLE',
  colors: { primary: '#FF2D78', secondary: '#A855F7' },
  active: true, members: 9, launchDate: '2026-02-20',
}

async function mockCommon(page) {
  // Never let Sentry phone home during tests, regardless of build-time DSN.
  await page.route(/sentry\.io/, (r) => r.abort())
  await page.route('**/api/auth/me', (r) => r.fulfill({ json: { user: null } }))
  await page.route('**/api/groups', (r) => r.fulfill({ json: [GROUP] }))
}

test('loads the daily game and wins on a correct guess', async ({ page }) => {
  await mockCommon(page)
  await page.route('**/api/twice/songs', (r) => r.fulfill({ json: { songs: SONGS } }))
  await page.route('**/api/twice/game/today', (r) => r.fulfill({
    json: {
      gameDate: '2026-05-26', gameNumber: 96, previewUrl: null, totalSongs: SONGS.length,
      hints: { era: 'TWICEcoaster', year: 2016, firstLetter: 'T' },
    },
  }))
  await page.route('**/api/twice/game/guess', async (route) => {
    const body = route.request().postDataJSON() || {}
    const correct = String(body.guess || '').trim().toLowerCase() === ANSWER.toLowerCase()
    await route.fulfill({
      json: {
        correct,
        gameOver: correct,
        ...(correct ? { song: { id: 2, title: ANSWER, album: 'TWICEcoaster', releaseYear: 2016, spotifyId: null } } : {}),
      },
    })
  })
  await page.route('**/api/stats/record', (r) => r.fulfill({ json: { ok: true } }))
  await page.route('**/api/twice/game/community/**', (r) => r.fulfill({ json: { totalPlays: 0 } }))

  await page.goto('/twice')

  const input = page.getByPlaceholder('Know it? Search for the song...')
  await expect(input).toBeVisible()

  await input.fill(ANSWER)
  await page.getByRole('option', { name: ANSWER, exact: true }).click()

  // Result modal confirms the win and offers the share action.
  await expect(page.getByRole('heading', { name: 'You got it!' })).toBeVisible()
  await expect(page.getByRole('button', { name: /share results/i })).toBeVisible()
})

test('renders the community stats page', async ({ page }) => {
  await mockCommon(page)
  await page.route('**/api/stats/summary', (r) => r.fulfill({
    json: [
      { group_id: 'twice', total_games: 120, win_rate: 64.5, avg_guesses: 3.4, avg_hints_used: 0.4, easy_games: 10, normal_games: 100, hard_games: 10 },
    ],
  }))
  await page.route('**/api/stats/songs/twice', (r) => r.fulfill({
    json: [
      { song_id: 2, song_title: 'TT', plays: 30, avg_guesses: 4.1, win_rate: 40, losses: 18 },
    ],
  }))

  await page.goto('/stats')

  await expect(page.getByRole('heading', { name: 'Community Stats' })).toBeVisible()
  await expect(page.getByText('Hardest songs')).toBeVisible()
  await expect(page.getByText('TWICE').first()).toBeVisible()
})
