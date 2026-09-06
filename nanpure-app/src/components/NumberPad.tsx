import type { Digit } from '../sudoku/types'

interface Props {
  remainingCounts: Record<Digit, number>
  onDigit: (digit: Digit) => void
  disabled: boolean
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as Digit[]

export const NumberPad = ({ remainingCounts, onDigit, disabled }: Props) => {
  return (
    <div className="number-pad">
      {DIGITS.map((d) => (
        <button
          key={d}
          type="button"
          className="number-pad__digit"
          onClick={() => onDigit(d)}
          disabled={disabled || remainingCounts[d] === 0}
        >
          {d}
        </button>
      ))}
    </div>
  )
}
