import { getBattleSocket } from './battleSocket'

// Estimates the offset between the server clock and this device's clock so the
// round countdown can align to the server's `startAt` (FR-5). One round-trip is
// plenty — a guessing game tolerates ~250ms of slop (NFR-1).

let offset = 0 // serverClock - localClock, in ms

export function syncServerTime() {
  const socket = getBattleSocket()
  return new Promise((resolve) => {
    const t0 = Date.now()
    socket.timeout(3000).emit('battle:time', null, (err, serverNow) => {
      if (!err && typeof serverNow === 'number') {
        const t1 = Date.now()
        const rtt = t1 - t0
        // serverNow corresponds to roughly the midpoint of the round-trip.
        offset = serverNow + rtt / 2 - t1
      }
      resolve(offset)
    })
  })
}

/** Local-clock time (ms) at which a server timestamp will occur. */
export function toLocalTime(serverTimestamp) {
  return serverTimestamp - offset
}
