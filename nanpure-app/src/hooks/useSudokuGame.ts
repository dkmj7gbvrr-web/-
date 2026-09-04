import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  PEERS,
  computeCandidates,
  digitBit,
  gridsEqual,
  isComplete,
} from '../sudoku/board'
import type { CandidateMap } from '../sudoku/board'
import { generatePuzzle } from '../sudoku/generator'
import { applyStepToCandidates, findNextStep } from '../sudoku/techniques'
import type { Difficulty, Digit, GeneratedPuzzle, Grid, HintStep } from '../sudoku/types'

export interface CellState {
  value: Digit
  given: boolean
  notes: number // ビットマスク（bit(d-1)が立っていれば候補dがメモされている）
}

const createBoard = (puzzle: Grid): CellState[] =>
  puzzle.map((v) => ({ value: v, given: v !== 0, notes: 0 }))

const boardValues = (board: CellState[]): Grid => board.map((c) => c.value) as Grid

/** 現在の入力値をもとに、行・列・箱で数字が重複しているマスの集合を返す */
const computeConflicts = (board: CellState[]): Set<number> => {
  const conflicts = new Set<number>()
  const grid = boardValues(board)
  for (let i = 0; i < 81; i++) {
    if (grid[i] === 0) continue
    for (const peer of PEERS[i]) {
      if (grid[peer] === grid[i]) {
        conflicts.add(i)
        conflicts.add(peer)
      }
    }
  }
  return conflicts
}

export type HintDisplay =
  | { kind: 'step'; step: HintStep }
  | { kind: 'fallback'; index: number; digit: Digit }
  | { kind: 'none-left' }

export const useSudokuGame = () => {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [puzzle, setPuzzle] = useState<GeneratedPuzzle | null>(null)
  const [board, setBoard] = useState<CellState[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [memoMode, setMemoMode] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [hint, setHint] = useState<HintDisplay | null>(null)
  const [history, setHistory] = useState<CellState[][]>([])

  const hintCandidatesRef = useRef<CandidateMap | null>(null)
  const timerRef = useRef<number | null>(null)

  const isSolved = useMemo(() => {
    if (!puzzle || board.length === 0) return false
    return gridsEqual(boardValues(board), puzzle.solution)
  }, [board, puzzle])

  const conflicts = useMemo(() => computeConflicts(board), [board])

  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (puzzle && !isSolved) {
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds((s) => s + 1)
      }, 1000)
    }
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle, isSolved])

  const startNewGame = useCallback((level: Difficulty) => {
    setIsGenerating(true)
    setDifficulty(level)
    setHint(null)
    hintCandidatesRef.current = null
    // 生成中はUIをブロックしすぎないよう次のタスクに回す
    window.setTimeout(() => {
      const generated = generatePuzzle(level)
      setPuzzle(generated)
      setBoard(createBoard(generated.puzzle))
      setSelected(null)
      setElapsedSeconds(0)
      setHistory([])
      setIsGenerating(false)
    }, 0)
  }, [])

  const backToMenu = useCallback(() => {
    setDifficulty(null)
    setPuzzle(null)
    setBoard([])
    setSelected(null)
    setHint(null)
    setHistory([])
    hintCandidatesRef.current = null
  }, [])

  const clearHint = useCallback(() => {
    setHint(null)
  }, [])

  const onBoardMutated = () => {
    hintCandidatesRef.current = null
    setHint(null)
  }

  const placeValue = useCallback(
    (index: number, digit: Digit) => {
      const cell = board[index]
      if (!cell || cell.given) return
      const next = board.slice()
      next[index] = { ...cell, value: digit, notes: 0 }
      if (digit !== 0) {
        const bit = digitBit(digit)
        for (const peer of PEERS[index]) {
          if (next[peer].notes & bit) {
            next[peer] = { ...next[peer], notes: next[peer].notes & ~bit }
          }
        }
      }
      setHistory((h) => [...h, board])
      setBoard(next)
      onBoardMutated()
    },
    [board],
  )

  const toggleNote = useCallback(
    (index: number, digit: Digit) => {
      const cell = board[index]
      if (!cell || cell.given || cell.value !== 0) return
      const next = board.slice()
      const bit = digitBit(digit)
      next[index] = { ...cell, notes: cell.notes ^ bit }
      setHistory((h) => [...h, board])
      setBoard(next)
    },
    [board],
  )

  const eraseCell = useCallback(
    (index: number) => {
      const cell = board[index]
      if (!cell || cell.given) return
      if (cell.value === 0 && cell.notes === 0) return
      const next = board.slice()
      next[index] = { ...cell, value: 0, notes: 0 }
      setHistory((h) => [...h, board])
      setBoard(next)
      onBoardMutated()
    },
    [board],
  )

  const undo = useCallback(() => {
    if (history.length === 0) return
    const previousBoard = history[history.length - 1]
    setHistory(history.slice(0, -1))
    setBoard(previousBoard)
    setHint(null)
    hintCandidatesRef.current = null
  }, [history])

  const inputDigit = useCallback(
    (digit: Digit) => {
      if (selected === null) return
      if (memoMode) {
        toggleNote(selected, digit)
      } else {
        placeValue(selected, digit)
      }
    },
    [selected, memoMode, placeValue, toggleNote],
  )

  const eraseSelected = useCallback(() => {
    if (selected === null) return
    eraseCell(selected)
  }, [selected, eraseCell])

  const requestHint = useCallback(() => {
    if (!puzzle) return
    const grid = boardValues(board)
    if (isComplete(grid)) return

    if (hintCandidatesRef.current === null) {
      hintCandidatesRef.current = computeCandidates(grid)
    }
    const candidates = hintCandidatesRef.current

    const step = findNextStep(grid, candidates)
    if (step) {
      hintCandidatesRef.current = applyStepToCandidates(candidates, step)
      setHint({ kind: 'step', step })
      if (step.fill !== undefined) setSelected(step.fill.index)
      else setSelected(step.highlightCells[0] ?? null)
      return
    }

    // 実装済みの技巧では説明できない状態（手詰まり）。既知の解から1マスだけ開示する。
    const emptyCells = grid
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => v === 0)
    if (emptyCells.length === 0) {
      setHint({ kind: 'none-left' })
      return
    }
    const target = emptyCells[Math.floor(Math.random() * emptyCells.length)]
    const digit = puzzle.solution[target.i]
    setHint({ kind: 'fallback', index: target.i, digit })
    setSelected(target.i)
  }, [board, puzzle])

  const applyHintFill = useCallback(() => {
    if (!hint) return
    if (hint.kind === 'step' && hint.step.fill) {
      placeValue(hint.step.fill.index, hint.step.fill.digit)
    } else if (hint.kind === 'fallback') {
      placeValue(hint.index, hint.digit)
    }
    setHint(null)
  }, [hint, placeValue])

  const applyHintElimination = useCallback(() => {
    if (!hint || hint.kind !== 'step' || hint.step.fill) return
    const next = board.slice()
    for (const { index, digit } of hint.step.eliminations) {
      const bit = digitBit(digit)
      if (next[index].notes & bit) {
        next[index] = { ...next[index], notes: next[index].notes & ~bit }
      }
    }
    setHistory((h) => [...h, board])
    setBoard(next)
    setHint(null)
  }, [board, hint])

  const remainingCounts = useMemo(() => {
    const counts: Record<Digit, number> = { 0: 0, 1: 9, 2: 9, 3: 9, 4: 9, 5: 9, 6: 9, 7: 9, 8: 9, 9: 9 }
    for (const cell of board) {
      if (cell.value !== 0) counts[cell.value]--
    }
    return counts
  }, [board])

  return {
    difficulty,
    puzzle,
    board,
    selected,
    memoMode,
    isGenerating,
    elapsedSeconds,
    hint,
    isSolved,
    conflicts,
    remainingCounts,
    setSelected,
    setMemoMode,
    startNewGame,
    backToMenu,
    inputDigit,
    eraseSelected,
    undo,
    canUndo: history.length > 0,
    requestHint,
    applyHintFill,
    applyHintElimination,
    clearHint,
  }
}
