import type { Digit } from '../sudoku/types'

interface Props {
  remainingCounts: Record<Digit, number>
  memoMode: boolean
  onDigit: (digit: Digit) => void
  onErase: () => void
  onToggleMemo: () => void
  onUndo: () => void
  canUndo: boolean
  disabled: boolean
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as Digit[]

export const NumberPad = ({
  remainingCounts,
  memoMode,
  onDigit,
  onErase,
  onToggleMemo,
  onUndo,
  canUndo,
  disabled,
}: Props) => {
  return (
    <div className="number-pad">
      <div className="number-pad__digits">
        {DIGITS.map((d) => (
          <button
            key={d}
            type="button"
            className="number-pad__digit"
            onClick={() => onDigit(d)}
            disabled={disabled || remainingCounts[d] === 0}
          >
            {d}
            <span className="number-pad__remaining">{remainingCounts[d]}</span>
          </button>
        ))}
      </div>
      <div className="number-pad__tools">
        <button
          type="button"
          className={'number-pad__tool' + (memoMode ? ' number-pad__tool--active' : '')}
          onClick={onToggleMemo}
          disabled={disabled}
        >
          メモ{memoMode ? ' ON' : ' OFF'}
        </button>
        <button type="button" className="number-pad__tool" onClick={onUndo} disabled={disabled || !canUndo}>
          戻す
        </button>
        <button type="button" className="number-pad__tool" onClick={onErase} disabled={disabled}>
          消す
        </button>
      </div>
    </div>
  )
}
