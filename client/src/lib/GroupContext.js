import { createContext, useContext } from 'react'

export const GroupContext = createContext('twice')

export function useGroup() {
  return useContext(GroupContext)
}
