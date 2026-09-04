import { DIFFICULTIES } from '../game/types'

interface Props {
  onSelect: (level: number) => void
}

export function DifficultySelector({ onSelect }: Props) {
  return (
    <div className="menu">
      <h1 className="menu__title">試験管パズル</h1>
      <p className="menu__lead">
        バラバラに入った色付きの液体を、1色ずつ同じ試験管にまとめよう。
        <br />
        試験管を2つタップすると、上にある液体を色が合う（か空の）試験管へ移せます。
      </p>
      <div className="menu__list">
        {DIFFICULTIES.map((d) => (
          <button type="button" key={d.level} className="menu__item" onClick={() => onSelect(d.level)}>
            <span className="menu__item-label">{d.label}</span>
            <span className="menu__item-sub">{d.colorCount}色</span>
          </button>
        ))}
      </div>
    </div>
  )
}
