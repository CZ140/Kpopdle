import { createContext, useContext } from 'react'

export const GroupContext = createContext({ id: 'twice', archiveDate: null })

export function useGroup() {
  return useContext(GroupContext).id
}

export function useArchiveDate() {
  return useContext(GroupContext).archiveDate ?? null
}
