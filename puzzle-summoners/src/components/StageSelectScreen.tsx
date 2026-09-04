import { DUNGEONS } from '../game/stages'
import type { Stage } from '../game/types'
import { ELEMENT_META } from '../game/orbTheme'

interface StageSelectScreenProps {
  readonly isStageCleared: (stageId: string) => boolean
  readonly canBattle: boolean
  readonly onSelectStage: (stage: Stage) => void
}

export const StageSelectScreen = ({ isStageCleared, canBattle, onSelectStage }: StageSelectScreenProps) => {
  return (
    <div className="screen">
      <h2>ダンジョン選択</h2>
      {!canBattle && <p className="error-text">パーティにモンスターが1体もいません。編成タブで仲間をセットしよう。</p>}

      {DUNGEONS.map((dungeon) => (
        <section key={dungeon.id} className="dungeon-section">
          <h3>{dungeon.name}</h3>
          <p className="screen-lead">{dungeon.description}</p>
          <div className="stage-list">
            {dungeon.stages.map((stage) => {
              const cleared = isStageCleared(stage.id)
              const meta = ELEMENT_META[stage.enemy.element]
              return (
                <button
                  key={stage.id}
                  className="stage-card"
                  disabled={!canBattle}
                  onClick={() => onSelectStage(stage)}
                >
                  <div className="stage-card-icon" style={{ background: meta.color }}>
                    {meta.icon}
                  </div>
                  <div className="stage-card-body">
                    <div className="stage-card-name">
                      {stage.name} {cleared && <span className="cleared-badge">クリア済</span>}
                    </div>
                    <div className="stage-card-meta">
                      推奨Lv{stage.recommendedLevel} ・ 敵HP{stage.enemy.maxHp} ・ 報酬 魔法石{stage.stoneReward} / コイン
                      {stage.coinReward}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
