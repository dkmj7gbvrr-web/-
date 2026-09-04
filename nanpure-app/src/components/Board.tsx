import { useMemo } from 'react'
import { PEERS } from '../sudoku/board'
import type { Digit } from '../sudoku/types'
import type { CellState, HintDisplay } from '../hooks/useSudokuGame'
import { Cell } from './Cell'

interface Props {
  board: CellState[]
  selected: number | null
  conflicts: Set<number>
  hint: HintDisplay | null
  onSelect: (index: number) => void
}

export const Board = ({ board, selected, conflicts, hint, onSelect }: Props) => {
  const peers = useMemo(() => {
    if (selected === null) return new Set<number>()
    return new Set(PEERS[selected])
  }, [selected])

  const selectedValue = selected !== null ? board[selected]?.value : 0

  const hintPrimary = useMemo(() => {
    if (!hint) return null
    if (hint.kind === 'step' && hint.step.fill) return hint.step.fill.index
    if (hint.kind === 'fallback') return hint.index
    return null
  }, [hint])

  const hintSecondary = useMemo(() => {
    if (!hint || hint.kind !== 'step') return new Set<number>()
    return new Set(hint.step.highlightCells.filter((i) => i !== hintPrimary))
  }, [hint, hintPrimary])

  const hintDigitsByCell = useMemo(() => {
    const map = new Map<number, Set<Digit>>()
    if (hint && hint.kind === 'step') {
      for (const { index, digit } of hint.step.highlightCandidates) {
        if (!map.has(index)) map.set(index, new Set())
        map.get(index)!.add(digit)
      }
    }
    return map
  }, [hint])

  if (board.length === 0) return null

  return (
    <div className="board" role="grid" aria-label="ナンプレ盤面">
      {board.map((state, index) => {
        const hintLevel: 'primary' | 'secondary' | null =
          index === hintPrimary ? 'primary' : hintSecondary.has(index) ? 'secondary' : null
        return (
          <Cell
            key={index}
            index={index}
            state={state}
            isSelected={selected === index}
            isPeer={peers.has(index)}
            isSameValue={selectedValue !== 0 && state.value === selectedValue && selected !== index}
            isConflict={conflicts.has(index)}
            hintLevel={hintLevel}
            hintDigits={hintDigitsByCell.get(index) ?? null}
            sameValueDigit={selectedValue !== 0 ? selectedValue : null}
            onSelect={onSelect}
          />
        )
      })}
    </div>
  )
}
