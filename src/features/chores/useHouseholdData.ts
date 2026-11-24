import { useEffect, useState } from 'react'
import { watchOpenOccurrences, type Occurrence } from '../../data/chores'
import { watchMembers, type Member } from '../../data/households'
import { db } from '../../lib/firebase'

/** Live open occurrences; null while loading. */
export function useOpenOccurrences(hid: string): Occurrence[] | null {
  const [list, setList] = useState<Occurrence[] | null>(null)
  useEffect(() => watchOpenOccurrences(db, hid, setList, () => setList([])), [hid])
  return list
}

/** Live members by uid (for avatars). */
export function useMembers(hid: string): Map<string, Member> {
  const [members, setMembers] = useState<Map<string, Member>>(new Map())
  useEffect(() => watchMembers(db, hid, (list) => setMembers(new Map(list.map((m) => [m.uid, m])))), [hid])
  return members
}
