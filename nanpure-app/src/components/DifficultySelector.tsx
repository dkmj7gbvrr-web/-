import { DIFFICULTIES } from '../sudoku/types'
import type { Difficulty } from '../sudoku/types'

interface Props {
  onSelect: (level: Difficulty) => void
}

export const DifficultySelector = ({ onSelect }: Props) => {
  return (
    <div className="difficulty-select">
      <h1>ナンプレ</h1>
      <p className="lead">難易度を選んでスタート</p>
      <div className="difficulty-grid">
        {DIFFICULTIES.map((d) => (
          <button
            key={d.level}
            type="button"
            className={`difficulty-card difficulty-card--${d.level}`}
            onClick={() => onSelect(d.level)}
          >
            <span className="difficulty-card__level">Lv.{d.level}</span>
            <span className="difficulty-card__label">{d.label}</span>
            <span className="difficulty-card__desc">{d.description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
