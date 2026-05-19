import { createContext, useContext } from 'react'

export const GroupContext = createContext({ id: 'twice', archiveDate: null, practiceMode: false })

export function useGroup() {
  return useContext(GroupContext).id
}

export function useArchiveDate() {
  return useContext(GroupContext).archiveDate ?? null
}

export function usePracticeMode() {
  return useContext(GroupContext).practiceMode
}
