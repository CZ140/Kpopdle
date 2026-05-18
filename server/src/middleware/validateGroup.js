import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let groups = null

function getGroups() {
  if (!groups) {
    groups = JSON.parse(readFileSync(join(__dirname, '../data/groups.json'), 'utf-8'))
  }
  return groups
}

export default function validateGroup(req, res, next) {
  const { group } = req.params
  const found = getGroups().find((g) => g.id === group && g.active)
  if (!found) {
    return res.status(404).json({ error: 'Group not found' })
  }
  req.groupConfig = found
  next()
}
