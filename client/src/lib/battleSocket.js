import { io } from 'socket.io-client'

// Connection lifecycle for Battle mode. The socket is a module singleton — its
// lifetime is intentionally decoupled from React mount/unmount so navigating
// from /battle to /battle/:id (a route remount) doesn't tear down the live
// connection. Components attach/detach listeners; they don't open/close the socket.

const TOKEN_KEY = 'kpopdle:playerToken'
const NAME_KEY = 'kpopdle:displayName'

/** Stable anonymous identity so a reconnect maps back to the same player (GD-9). */
export function getPlayerToken() {
  let token = localStorage.getItem(TOKEN_KEY)
  if (!token) {
    token = crypto.randomUUID()
    localStorage.setItem(TOKEN_KEY, token)
  }
  return token
}

export function getSavedName() {
  return localStorage.getItem(NAME_KEY) || ''
}

export function saveName(name) {
  localStorage.setItem(NAME_KEY, name)
}

let socket = null

export function getBattleSocket() {
  // Same origin; default /socket.io path (vite proxies it in dev).
  if (!socket) socket = io({ autoConnect: true })
  return socket
}

export function closeBattleSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
