import { MatchManager } from './MatchManager.js'

// Single shared registry of live matches, used by BOTH the socket layer
// (realtime/socket.js) and the audio-proxy HTTP route (routes/battle.js). Its
// emitFactory is bound to `io` once the socket server is attached at startup.
export const matchManager = new MatchManager()
