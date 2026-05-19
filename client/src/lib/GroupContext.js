import { createContext, useContext } from 'react'

export const GroupContext = createContext({ id: 'twice', archiveDate: null, practiceMode: false, difficulty: 'normal', setDifficulty: () => {} })

export function useGroup() {
  return useContext(GroupContext).id
}

export function useArchiveDate() {
  return useContext(GroupContext).archiveDate ?? null
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
