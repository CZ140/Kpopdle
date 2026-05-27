import { Router } from 'express'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { captureError } from '../services/observability.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const router = Router()

router.get('/', (req, res) => {
  try {
    const all = JSON.parse(readFileSync(join(__dirname, '../data/groups.json'), 'utf-8'))
    res.json(all.filter((g) => g.active))
  } catch (err) {
    captureError(err, { msg: 'Error fetching groups' })
    res.status(500).json({ error: 'Failed to load groups' })
  }
})

export default router
