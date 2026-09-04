import { ELEMENTS } from './types'
import type { AttackElement, MonsterDef } from './types'
import type { MatchGroup } from './board'

export interface TeamStats {
  readonly maxHp: number
  readonly rcv: number
  readonly atkByElement: Record<AttackElement, number>
  readonly leaderName: string | null
}

/**
 * パーティ全体のステータスを計算する。先頭のモンスターがリーダーとなり、
 * リーダースキルの対象属性の攻撃力にリーダースキル倍率がチーム全体に掛かる。
 */
export const computeTeamStats = (members: readonly MonsterDef[]): TeamStats => {
  const atkByElement: Record<AttackElement, number> = { fire: 0, water: 0, wood: 0, light: 0, dark: 0 }
  let maxHp = 0
  let rcv = 0

  for (const member of members) {
    atkByElement[member.element] += member.baseAtk
    maxHp += member.baseHp
    rcv += member.baseRcv
  }

  const leader = members[0] ?? null
  if (leader) {
    atkByElement[leader.leaderSkill.element] *= leader.leaderSkill.multiplier
  }

  return { maxHp, rcv, atkByElement, leaderName: leader?.name ?? null }
}

export interface TurnResult {
  readonly comboCount: number
  readonly damageToEnemy: number
  readonly healAmount: number
}

const GROUP_SIZE_BONUS = 0.25
const COMBO_BONUS = 0.25

/** 揃ったコンボ一覧から、敵に与えるダメージと回復量を計算する（実機パズドラのコンボ倍率式を簡略化したもの） */
export const computeTurnResult = (groups: readonly MatchGroup[], team: TeamStats): TurnResult => {
  const comboCount = groups.length
  if (comboCount === 0) return { comboCount: 0, damageToEnemy: 0, healAmount: 0 }

  const comboMultiplier = 1 + COMBO_BONUS * (comboCount - 1)
  let damage = 0
  let heal = 0

  for (const group of groups) {
    const groupBonus = 1 + GROUP_SIZE_BONUS * Math.max(0, group.cells.length - 3)
    if (group.element === 'heart') {
      heal += team.rcv * groupBonus
    } else {
      damage += team.atkByElement[group.element] * groupBonus
    }
  }

  damage *= comboMultiplier
  heal *= comboMultiplier

  return { comboCount, damageToEnemy: Math.round(damage), healAmount: Math.round(heal) }
}

export const isAttackElement = (element: string): element is AttackElement =>
  (ELEMENTS as readonly string[]).includes(element)
