import { Router } from 'express'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const router = Router()

router.get('/', (req, res) => {
  try {
    const all = JSON.parse(readFileSync(join(__dirname, '../data/groups.json'), 'utf-8'))
    res.json(all.filter((g) => g.active))
  } catch (err) {
    console.error('Error fetching groups:', err)
    res.status(500).json({ error: 'Failed to load groups' })
  }
})

export default router
