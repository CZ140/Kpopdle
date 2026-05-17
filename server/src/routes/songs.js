import { Router } from 'express'
import { getSongTitles } from '../data/songIndex.js'

const router = Router()

router.get('/', (req, res) => {
  const songs = getSongTitles()
  res.json({ songs })
})

export default router
