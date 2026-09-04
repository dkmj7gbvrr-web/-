import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Board, CascadeStep } from '../game/board'
import { createRandomBoard, resolveCascadeSteps } from '../game/board'
import { computeTeamStats, computeTurnResult } from '../game/battle'
import type { TeamStats } from '../game/battle'
import { mulberry32, randomSeed } from '../game/rng'
import type { AttackElement, MonsterDef, Stage } from '../game/types'
import { ELEMENT_META } from '../game/orbTheme'
import { OrbBoard } from './OrbBoard'
import type { OrbAnimState } from './OrbBoard'
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

interface FloatingText {
  readonly id: number
  readonly target: 'enemy' | 'team'
  readonly text: string
  readonly kind: 'damage' | 'heal'
}

interface ComboPopup {
  readonly id: number
  readonly combo: number
}

type BattleStatus = 'playing' | 'won' | 'lost'

const HIGHLIGHT_MS = 220
const CLEAR_MS = 200
const SETTLE_MS = 420

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const positionsToAnimMap = (positions: readonly { row: number; col: number }[], state: OrbAnimState) => {
  const map = new Map<string, OrbAnimState>()
  for (const { row, col } of positions) map.set(`${row}-${col}`, state)
  return map
}

const collectRefilledPositions = (boardAfterClear: Board) => {
  const positions: { row: number; col: number }[] = []
  boardAfterClear.forEach((rowCells, row) => {
    rowCells.forEach((cell, col) => {
      if (cell === null) positions.push({ row, col })
    })
  })
  return positions
}

export const BattleScreen = ({ stage, partyMonsterDefs, onFinish, onExit }: BattleScreenProps) => {
  const [rng] = useState(() => mulberry32(randomSeed()))
  const team = useMemo(() => computeTeamStats(partyMonsterDefs), [partyMonsterDefs])

  const [board, setBoard] = useState<Board>(() => createRandomBoard(rng))
  const [cellAnim, setCellAnim] = useState<ReadonlyMap<string, OrbAnimState> | undefined>(undefined)
  const [enemyHp, setEnemyHp] = useState(stage.enemy.maxHp)
  const [teamHp, setTeamHp] = useState(team.maxHp)
  const [status, setStatus] = useState<BattleStatus>('playing')
  const [animating, setAnimating] = useState(false)
  const [log, setLog] = useState<LogEntry[]>([])
  const [outcome, setOutcome] = useState<StageClearOutcome | null>(null)
  const [skillCooldowns, setSkillCooldowns] = useState<number[]>(() =>
    partyMonsterDefs.map((m) => m.activeSkill.maxCooldown),
  )
  const [pendingBoost, setPendingBoost] = useState<PendingBoost | null>(null)
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([])
  const [comboPopup, setComboPopup] = useState<ComboPopup | null>(null)
  const logIdRef = useRef(0)
  const floatingIdRef = useRef(0)
  const comboIdRef = useRef(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const pushLog = (text: string) => {
    logIdRef.current += 1
    const id = logIdRef.current
    setLog((prev) => [{ id, text }, ...prev].slice(0, 6))
  }

  const spawnFloatingText = (target: 'enemy' | 'team', text: string, kind: 'damage' | 'heal') => {
    floatingIdRef.current += 1
    setFloatingTexts((prev) => [...prev, { id: floatingIdRef.current, target, text, kind }])
  }

  const removeFloatingText = (id: number) => {
    setFloatingTexts((prev) => prev.filter((f) => f.id !== id))
  }

  const handleUseSkill = (index: number) => {
    if (status !== 'playing' || animating) return
    const monster = partyMonsterDefs[index]
    if (!monster || skillCooldowns[index] > 0) return

    const skill = monster.activeSkill
    const effect = skill.effect

    if (effect.kind === 'damage') {
      const nextEnemyHp = Math.max(0, enemyHp - effect.amount)
      setEnemyHp(nextEnemyHp)
      spawnFloatingText('enemy', `-${effect.amount}`, 'damage')
      pushLog(`${monster.name}のスキル「${skill.name}」！ ${stage.enemy.name}に${effect.amount}ダメージ！`)
      if (nextEnemyHp <= 0) {
        setStatus('won')
        setOutcome(onFinish(true))
        pushLog(`${stage.enemy.name}を倒した！`)
      }
    } else if (effect.kind === 'heal') {
      setTeamHp(Math.min(team.maxHp, teamHp + effect.amount))
      spawnFloatingText('team', `+${effect.amount}`, 'heal')
      pushLog(`${monster.name}のスキル「${skill.name}」！ HPが${effect.amount}回復した`)
    } else {
      setPendingBoost({ element: effect.element, multiplier: effect.multiplier })
      pushLog(
        `${monster.name}のスキル「${skill.name}」！ 次のターン${ELEMENT_META[effect.element].label}属性の攻撃力が${effect.multiplier}倍に！`,
      )
    }

    setSkillCooldowns((prev) => prev.map((c, i) => (i === index ? skill.maxCooldown : c)))
  }

  const playCascadeSteps = async (steps: readonly CascadeStep[], activeTeam: TeamStats) => {
    let currentEnemyHp = enemyHp
    let currentTeamHp = teamHp
    let cumulativeCombo = 0

    for (const step of steps) {
      setCellAnim(positionsToAnimMap(step.matchedCells, 'highlight'))
      await sleep(HIGHLIGHT_MS)
      if (!mountedRef.current) return

      setCellAnim(positionsToAnimMap(step.matchedCells, 'clearing'))
      await sleep(CLEAR_MS)
      if (!mountedRef.current) return

      const refilled = collectRefilledPositions(step.boardAfterClear)
      setBoard(step.boardAfterSettle)
      setCellAnim(positionsToAnimMap(refilled, 'popping'))

      cumulativeCombo += step.groups.length
      const stepResult = computeTurnResult(step.groups, activeTeam)

      if (stepResult.damageToEnemy > 0) {
        currentEnemyHp = Math.max(0, currentEnemyHp - stepResult.damageToEnemy)
        setEnemyHp(currentEnemyHp)
        spawnFloatingText('enemy', `-${stepResult.damageToEnemy}`, 'damage')
      }
      if (stepResult.healAmount > 0) {
        currentTeamHp = Math.min(team.maxHp, currentTeamHp + stepResult.healAmount)
        setTeamHp(currentTeamHp)
        spawnFloatingText('team', `+${stepResult.healAmount}`, 'heal')
      }

      comboIdRef.current += 1
      setComboPopup({ id: comboIdRef.current, combo: cumulativeCombo })
      pushLog(`${cumulativeCombo}コンボ！ ${stage.enemy.name}に${stepResult.damageToEnemy}ダメージ！`)

      if (currentEnemyHp <= 0) {
        setStatus('won')
        setOutcome(onFinish(true))
        pushLog(`${stage.enemy.name}を倒した！`)
        setCellAnim(undefined)
        setAnimating(false)
        return
      }

      await sleep(SETTLE_MS)
      if (!mountedRef.current) return
      setCellAnim(undefined)
    }

    const damageTaken = stage.enemy.atk
    const nextTeamHp = Math.max(0, currentTeamHp - damageTaken)
    setTeamHp(nextTeamHp)
    spawnFloatingText('team', `-${damageTaken}`, 'damage')
    pushLog(`${stage.enemy.name}の攻撃！ ${damageTaken}ダメージを受けた`)

    if (nextTeamHp <= 0) {
      setStatus('lost')
      onFinish(false)
    }

    setAnimating(false)
  }

  const handleDragEnd = (finalBoard: Board) => {
    if (status !== 'playing' || animating) return

    setBoard(finalBoard)
    setComboPopup(null)

    const steps = resolveCascadeSteps(finalBoard, rng)
    setSkillCooldowns((prev) => prev.map((c) => Math.max(0, c - 1)))

    const activeTeam: TeamStats = pendingBoost
      ? {
          ...team,
          atkByElement: {
            ...team.atkByElement,
            [pendingBoost.element]: team.atkByElement[pendingBoost.element] * pendingBoost.multiplier,
          },
        }
      : team
    if (pendingBoost) setPendingBoost(null)

    if (steps.length === 0) {
      pushLog('コンボなし…')
      return
    }

    setAnimating(true)
    void playCascadeSteps(steps, activeTeam)
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
          <div className="hp-bar-anchor">
            <HpBar current={enemyHp} max={stage.enemy.maxHp} color="#d9534f" />
            {floatingTexts
              .filter((f) => f.target === 'enemy')
              .map((f) => (
                <span
                  key={f.id}
                  className={`floating-text floating-text--${f.kind}`}
                  onAnimationEnd={() => removeFloatingText(f.id)}
                >
                  {f.text}
                </span>
              ))}
          </div>
        </div>
      </div>

      {comboPopup && (
        <div key={comboPopup.id} className={`combo-popup${comboPopup.combo >= 5 ? ' combo-popup--mega' : ''}`}>
          {comboPopup.combo} COMBO!
        </div>
      )}

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
        <div className="hp-bar-anchor">
          <HpBar current={teamHp} max={team.maxHp} color="#5cb85c" />
          {floatingTexts
            .filter((f) => f.target === 'team')
            .map((f) => (
              <span
                key={f.id}
                className={`floating-text floating-text--${f.kind}`}
                onAnimationEnd={() => removeFloatingText(f.id)}
              >
                {f.text}
              </span>
            ))}
        </div>
      </div>

      {pendingBoost && (
        <p className="boost-banner">
          ⬆ 次のターン{ELEMENT_META[pendingBoost.element].label}属性の攻撃力が{pendingBoost.multiplier}倍！
        </p>
      )}

      <div className="skill-bar">
        {partyMonsterDefs.map((monster, index) => {
          const cooldown = skillCooldowns[index] ?? 0
          const ready = cooldown === 0 && status === 'playing' && !animating
          return (
            <button
              key={index}
              type="button"
              className={`skill-button${ready ? ' skill-button--ready' : ''}`}
              style={{ '--skill-color': ELEMENT_META[monster.element].color } as CSSProperties}
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

      <OrbBoard board={board} disabled={status !== 'playing' || animating} onDragEnd={handleDragEnd} cellAnim={cellAnim} />

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
