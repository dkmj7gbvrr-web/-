import type { GameState } from '../game/types'

interface StatusPanelProps {
  state: GameState
}

function formatTimeShort(remaining: number): string | null {
  if (remaining <= 0) return null
  if (!Number.isFinite(remaining)) return '確率変動中 (次回大当たりまで継続)'
  return `時短中 (残り${remaining}回転)`
}

export function StatusPanel({ state }: StatusPanelProps) {
  const timeShortLabel = formatTimeShort(state.timeShortRemaining)
  const bonusActive = state.bonus.phase !== 'idle' && state.bonus.phase !== 'finished'

  return (
    <div className="status-panel">
      <div className="status-row status-row--balls">
        <span className="status-label">持ち球</span>
        <span className="status-value status-value--balls">{state.stats.ballCount.toLocaleString()}</span>
      </div>

      <div className={`status-badge status-badge--${state.mode}`}>
        {state.mode === 'kakuhen' ? '確率変動中' : '通常'}
      </div>
      {timeShortLabel && <div className="status-badge status-badge--timeshort">{timeShortLabel}</div>}

      {bonusActive && (
        <div className="status-bonus">
          <div>
            ラウンド {state.bonus.roundIndex} / {state.bonus.totalRounds}
          </div>
          <div>
            獲得個数 {state.bonus.capturedThisRound} (通算 {state.bonus.capturedTotal})
          </div>
        </div>
      )}

      <dl className="status-stats">
        <div>
          <dt>累計回転数</dt>
          <dd>{state.stats.totalStarts.toLocaleString()}</dd>
        </div>
        <div>
          <dt>大当たり回数</dt>
          <dd>{state.stats.totalJackpots.toLocaleString()}</dd>
        </div>
        <div>
          <dt>連チャン中</dt>
          <dd>{state.stats.kakuhenChain}</dd>
        </div>
        <div>
          <dt>発射数</dt>
          <dd>{state.stats.totalLaunched.toLocaleString()}</dd>
        </div>
      </dl>
    </div>
  )
}
