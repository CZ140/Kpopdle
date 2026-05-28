import { createContext, useContext } from 'react'
import { MAX_GUESSES } from './constants'

export const GroupContext = createContext({ id: 'twice', archiveDate: null, setArchiveDate: () => {}, launchDate: null, practiceMode: false, difficulty: 'normal', setDifficulty: () => {}, maxGuesses: MAX_GUESSES, snippetLadder: null, gameName: null })

export function useGroup() {
  return useContext(GroupContext).id
}

export function useArchiveDate() {
  return useContext(GroupContext).archiveDate ?? null
}

export function useSetArchiveDate() {
  return useContext(GroupContext).setArchiveDate
}

export function useLaunchDate() {
  return useContext(GroupContext).launchDate ?? null
}

export function usePracticeMode() {
  return useContext(GroupContext).practiceMode
}

export function useDifficulty() {
  return useContext(GroupContext).difficulty
}

export function useSetDifficulty() {
  return useContext(GroupContext).setDifficulty
}

// Per-mode attempt cap. Daily song games default to MAX_GUESSES (6); modes that
// set a tighter cap (e.g. Guess the Group = 3) override it via the provider.
export function useMaxGuesses() {
  return useContext(GroupContext).maxGuesses ?? MAX_GUESSES
}

// Optional per-mode snippet-duration ladder. When null, callers fall back to the
// difficulty-based DIFFICULTIES ladder.
export function useSnippetLadder() {
  return useContext(GroupContext).snippetLadder ?? null
}

// Optional per-mode share-header name. When null, ShareButton derives it from
// GAME_NAMES by group id.
export function useGameName() {
  return useContext(GroupContext).gameName ?? null
}
