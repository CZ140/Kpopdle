import { Router } from 'express'
import { getSongTitlesForGroup } from '../data/songIndex.js'
import validateGroup from '../middleware/validateGroup.js'

const router = Router({ mergeParams: true })

router.use(validateGroup)

router.get('/', (req, res) => {
  const songs = getSongTitlesForGroup(req.params.group)
  res.json({ songs })
})

export default router
