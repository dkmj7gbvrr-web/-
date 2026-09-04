import type { Digit } from '../sudoku/types'
import type { CellState } from '../hooks/useSudokuGame'

interface Props {
  index: number
  state: CellState
  isSelected: boolean
  isPeer: boolean
  isSameValue: boolean
  isConflict: boolean
  hintLevel: 'primary' | 'secondary' | null
  hintDigits: Set<Digit> | null
  /** 選択中のマスに入っている数字。空マスのメモの中の同じ数字を目立たせるのに使う */
  sameValueDigit: Digit | null
  onSelect: (index: number) => void
}

export const Cell = ({
  index,
  state,
  isSelected,
  isPeer,
  isSameValue,
  isConflict,
  hintLevel,
  hintDigits,
  sameValueDigit,
  onSelect,
}: Props) => {
  const row = Math.floor(index / 9)
  const col = index % 9

  const classes = ['cell']
  if (state.given) classes.push('cell--given')
  if (isSelected) classes.push('cell--selected')
  else if (isPeer) classes.push('cell--peer')
  if (isSameValue) classes.push('cell--same-value')
  if (isConflict) classes.push('cell--conflict')
  if (hintLevel) classes.push(`cell--hint-${hintLevel}`)
  if (col % 3 === 0) classes.push('cell--block-left')
  if (row % 3 === 0) classes.push('cell--block-top')
  if (col === 8) classes.push('cell--edge-right')
  if (row === 8) classes.push('cell--edge-bottom')

  return (
    <button
      type="button"
      className={classes.join(' ')}
      onClick={() => onSelect(index)}
      aria-label={`${row + 1}行${col + 1}列`}
    >
      {state.value !== 0 ? (
        <span className="cell__value">{state.value}</span>
      ) : (
        <span className="cell__notes">
          {Array.from({ length: 9 }, (_, i) => (i + 1) as Digit).map((d) => {
            const noted = (state.notes & (1 << (d - 1))) !== 0
            const emphasized = hintDigits?.has(d) ?? false
            const sameValue = noted && sameValueDigit === d
            return (
              <span
                key={d}
                className={
                  'cell__note' +
                  (noted ? ' cell__note--on' : '') +
                  (emphasized ? ' cell__note--hint' : '') +
                  (sameValue ? ' cell__note--same-value' : '')
                }
              >
                {noted || emphasized ? d : ''}
              </span>
            )
          })}
        </span>
      )}
    </button>
  )
}
