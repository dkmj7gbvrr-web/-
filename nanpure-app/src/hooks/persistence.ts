import type { Difficulty, GeneratedPuzzle } from '../sudoku/types'
import type { CellState } from './useSudokuGame'

const STORAGE_KEY = 'nanpure-save-v1'
const SAVE_VERSION = 1

export interface SavedGame {
  version: number
  difficulty: Difficulty
  puzzle: GeneratedPuzzle
  board: CellState[]
  elapsedSeconds: number
  memoMode: boolean
  mistakeCount: number
}

/** 保存データの形が壊れていないか最低限チェックする */
const isValidSavedGame = (value: unknown): value is SavedGame => {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<SavedGame>
  return (
    v.version === SAVE_VERSION &&
    typeof v.difficulty === 'number' &&
    Array.isArray(v.board) &&
    v.board.length === 81 &&
    !!v.puzzle &&
    Array.isArray(v.puzzle.puzzle) &&
    Array.isArray(v.puzzle.solution) &&
    typeof v.elapsedSeconds === 'number'
  )
}

export const loadSavedGame = (): SavedGame | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isValidSavedGame(parsed) ? parsed : null
  } catch {
    return null
  }
}

export const saveGame = (data: Omit<SavedGame, 'version'>): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SAVE_VERSION, ...data }))
  } catch {
    // localStorageが使えない・容量オーバー等: 保存は諦めるが、プレイ自体は継続させる
  }
}

export const clearSavedGame = (): void => {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // no-op
  }
}
