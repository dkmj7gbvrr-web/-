import { STARTER_MONSTER_ID } from './monsters'
import type { OwnedMonster, PlayerState } from './types'
import { PARTY_SIZE } from './types'

const STORAGE_KEY = 'puzzle-summoners:player-state:v1'

export const createUid = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `uid-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const createInitialPlayerState = (): PlayerState => {
  const starter: OwnedMonster = { uid: createUid(), defId: STARTER_MONSTER_ID }
  const party: (string | null)[] = new Array(PARTY_SIZE).fill(null)
  party[0] = starter.uid

  return {
    stones: 150,
    coins: 500,
    ownedMonsters: [starter],
    party,
    clearedStageIds: [],
    pullCountSinceRare: 0,
    totalPulls: 0,
  }
}

const isValidPlayerState = (value: unknown): value is PlayerState => {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.stones === 'number' &&
    typeof v.coins === 'number' &&
    Array.isArray(v.ownedMonsters) &&
    Array.isArray(v.party) &&
    Array.isArray(v.clearedStageIds) &&
    typeof v.pullCountSinceRare === 'number' &&
    typeof v.totalPulls === 'number'
  )
}

export const loadPlayerState = (): PlayerState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createInitialPlayerState()
    const parsed: unknown = JSON.parse(raw)
    if (!isValidPlayerState(parsed)) return createInitialPlayerState()
    return parsed
  } catch {
    return createInitialPlayerState()
  }
}

export const savePlayerState = (state: PlayerState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 保存先が使えない環境（プライベートモード等）では静かに諦める
  }
}

export const resetPlayerState = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // no-op
  }
}
