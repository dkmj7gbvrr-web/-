import { useMemo, useRef, useState } from 'react'
import type { Board } from '../game/board'
import { createRandomBoard, resolveCascades } from '../game/board'
import { computeTeamStats, computeTurnResult } from '../game/battle'
import { mulberry32, randomSeed } from '../game/rng'
import type { AttackElement, MonsterDef, Stage } from '../game/types'
import { ELEMENT_META } from '../game/orbTheme'
import { OrbBoard } from './OrbBoard'
import { HpBar } from './HpBar'
import type { StageClearOutcome } from '../hooks/useGameState'

interface BattleScreenProps {
  readonly stage: Stage
  readonly partyMonsterDefs: readonly MonsterDef[]
  readonly onFinish: (victory: boolean) => StageClearOutcome
  readonly onExit: () => void
}

interface LogEntry {
  readonly id: number
  readonly text: string
}

interface PendingBoost {
  readonly element: AttackElement
  readonly multiplier: number
}

type BattleStatus = 'playing' | 'won' | 'lost'

export const BattleScreen = ({ stage, partyMonsterDefs, onFinish, onExit }: BattleScreenProps) => {
  const [rng] = useState(() => mulberry32(randomSeed()))
  const team = useMemo(() => computeTeamStats(partyMonsterDefs), [partyMonsterDefs])

  const [board, setBoard] = useState<Board>(() => createRandomBoard(rng))
  const [enemyHp, setEnemyHp] = useState(stage.enemy.maxHp)
  const [teamHp, setTeamHp] = useState(team.maxHp)
  const [status, setStatus] = useState<BattleStatus>('playing')
  const [log, setLog] = useState<LogEntry[]>([])
  const [outcome, setOutcome] = useState<StageClearOutcome | null>(null)
  const [skillCooldowns, setSkillCooldowns] = useState<number[]>(() =>
    partyMonsterDefs.map((m) => m.activeSkill.maxCooldown),
  )
  const [pendingBoost, setPendingBoost] = useState<PendingBoost | null>(null)
  const logIdRef = useRef(0)

  const pushLog = (text: string) => {
    logIdRef.current += 1
    const id = logIdRef.current
    setLog((prev) => [{ id, text }, ...prev].slice(0, 6))
  }

  const handleUseSkill = (index: number) => {
    if (status !== 'playing') return
    const monster = partyMonsterDefs[index]
    if (!monster || skillCooldowns[index] > 0) return

    const skill = monster.activeSkill
    const effect = skill.effect

    if (effect.kind === 'damage') {
      const nextEnemyHp = Math.max(0, enemyHp - effect.amount)
      setEnemyHp(nextEnemyHp)
      pushLog(`${monster.name}のスキル「${skill.name}」！ ${stage.enemy.name}に${effect.amount}ダメージ！`)
      if (nextEnemyHp <= 0) {
        setStatus('won')
        setOutcome(onFinish(true))
        pushLog(`${stage.enemy.name}を倒した！`)
      }
    } else if (effect.kind === 'heal') {
      setTeamHp(Math.min(team.maxHp, teamHp + effect.amount))
      pushLog(`${monster.name}のスキル「${skill.name}」！ HPが${effect.amount}回復した`)
    } else {
      setPendingBoost({ element: effect.element, multiplier: effect.multiplier })
      pushLog(
        `${monster.name}のスキル「${skill.name}」！ 次のターン${ELEMENT_META[effect.element].label}属性の攻撃力が${effect.multiplier}倍に！`,
      )
    }

    setSkillCooldowns((prev) => prev.map((c, i) => (i === index ? skill.maxCooldown : c)))
  }

  const handleDragEnd = (finalBoard: Board) => {
    if (status !== 'playing') return

    const { finalBoard: settledBoard, groups } = resolveCascades(finalBoard, rng)
    setBoard(settledBoard)
    setSkillCooldowns((prev) => prev.map((c) => Math.max(0, c - 1)))

    const activeTeam = pendingBoost
      ? {
          ...team,
          atkByElement: {
            ...team.atkByElement,
            [pendingBoost.element]: team.atkByElement[pendingBoost.element] * pendingBoost.multiplier,
          },
        }
      : team
    if (pendingBoost) setPendingBoost(null)

    if (groups.length === 0) {
      pushLog('コンボなし…')
      return
    }

    const result = computeTurnResult(groups, activeTeam)
    const nextEnemyHp = result.damageToEnemy > 0 ? Math.max(0, enemyHp - result.damageToEnemy) : enemyHp
    const healedTeamHp = result.healAmount > 0 ? Math.min(team.maxHp, teamHp + result.healAmount) : teamHp

    if (result.damageToEnemy > 0) {
      setEnemyHp(nextEnemyHp)
      pushLog(`${result.comboCount}コンボ！ ${stage.enemy.name}に${result.damageToEnemy}ダメージ！`)
    }
    if (result.healAmount > 0) {
      setTeamHp(healedTeamHp)
      pushLog(`回復！ HPが${result.healAmount}回復した`)
    }

    if (nextEnemyHp <= 0) {
      setStatus('won')
      setOutcome(onFinish(true))
      pushLog(`${stage.enemy.name}を倒した！`)
      return
    }

    const damageTaken = stage.enemy.atk
    const nextTeamHp = Math.max(0, healedTeamHp - damageTaken)
    setTeamHp(nextTeamHp)
    pushLog(`${stage.enemy.name}の攻撃！ ${damageTaken}ダメージを受けた`)

    if (nextTeamHp <= 0) {
      setStatus('lost')
      onFinish(false)
    }
  }

  const enemyMeta = ELEMENT_META[stage.enemy.element]

  return (
    <div className="battle-screen">
      <div className="battle-header">
        <button className="ghost-button" onClick={onExit}>
          ← 撤退する
        </button>
        <h2>{stage.name}</h2>
      </div>

      <div className="enemy-panel">
        <div className="enemy-portrait" style={{ background: enemyMeta.color }}>
          {enemyMeta.icon}
        </div>
        <div className="enemy-info">
          <div className="enemy-name">{stage.enemy.name}</div>
          <HpBar current={enemyHp} max={stage.enemy.maxHp} color="#d9534f" />
        </div>
      </div>

      <div className="battle-log">
        {log.map((entry) => (
          <div key={entry.id} className="battle-log-entry">
            {entry.text}
          </div>
        ))}
      </div>

      <div className="team-panel">
        <span>
          リーダー: {team.leaderName ?? 'なし'}
          {partyMonsterDefs[0] && <span className="team-panel-leader-skill">（{partyMonsterDefs[0].leaderSkill.name}）</span>}
        </span>
        <HpBar current={teamHp} max={team.maxHp} color="#5cb85c" />
      </div>

      {pendingBoost && (
        <p className="boost-banner">
          ⬆ 次のターン{ELEMENT_META[pendingBoost.element].label}属性の攻撃力が{pendingBoost.multiplier}倍！
        </p>
      )}

      <div className="skill-bar">
        {partyMonsterDefs.map((monster, index) => {
          const cooldown = skillCooldowns[index] ?? 0
          const ready = cooldown === 0 && status === 'playing'
          return (
            <button
              key={index}
              type="button"
              className={`skill-button${ready ? ' skill-button--ready' : ''}`}
              style={{ background: ELEMENT_META[monster.element].color }}
              disabled={!ready}
              onClick={() => handleUseSkill(index)}
              title={`${monster.activeSkill.name}: ${monster.activeSkill.description}`}
            >
              <span className="skill-button-icon">{ELEMENT_META[monster.element].icon}</span>
              <span className="skill-button-status">{ready ? 'スキル' : cooldown}</span>
            </button>
          )
        })}
      </div>

      <OrbBoard board={board} disabled={status !== 'playing'} onDragEnd={handleDragEnd} />

      {status !== 'playing' && (
        <div className="battle-result-overlay">
          <div className="battle-result-card">
            <h3>{status === 'won' ? '勝利！' : '敗北…'}</h3>
            {status === 'won' && outcome && (
              <div className="battle-rewards">
                <p>魔法石 +{outcome.stoneReward}</p>
                <p>コイン +{outcome.coinReward}</p>
                {outcome.droppedMonster && <p>初回クリア報酬: {outcome.droppedMonster.name} を手に入れた！</p>}
              </div>
            )}
            <button className="primary-button" onClick={onExit}>
              ステージ選択に戻る
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
