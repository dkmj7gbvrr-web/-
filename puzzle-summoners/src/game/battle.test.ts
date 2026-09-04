import { describe, expect, it } from 'vitest'
import { computeTeamStats, computeTurnResult } from './battle'
import { getMonsterDef } from './monsters'
import type { MatchGroup } from './board'

describe('computeTeamStats', () => {
  it('メンバー全員のHP/RCVを合算する', () => {
    const members = [getMonsterDef('fire-3'), getMonsterDef('water-1')]
    const stats = computeTeamStats(members)
    expect(stats.maxHp).toBe(members[0].baseHp + members[1].baseHp)
    expect(stats.rcv).toBe(members[0].baseRcv + members[1].baseRcv)
  })

  it('先頭メンバーのリーダースキルが該当属性の攻撃力に掛かる', () => {
    const leader = getMonsterDef('fire-6') // 紅蓮竜皇イグニス: 火属性 x3.0
    const sub = getMonsterDef('fire-1')
    const stats = computeTeamStats([leader, sub])
    const rawFireAtk = leader.baseAtk + sub.baseAtk
    expect(stats.atkByElement.fire).toBeCloseTo(rawFireAtk * leader.leaderSkill.multiplier)
    expect(stats.leaderName).toBe(leader.name)
  })

  it('リーダーと異なる属性の攻撃力には倍率がかからない', () => {
    const leader = getMonsterDef('fire-6')
    const waterSub = getMonsterDef('water-1')
    const stats = computeTeamStats([leader, waterSub])
    expect(stats.atkByElement.water).toBe(waterSub.baseAtk)
  })
})

describe('computeTurnResult', () => {
  const team = computeTeamStats([getMonsterDef('fire-4')])

  it('コンボが0なら被害も回復も0', () => {
    const result = computeTurnResult([], team)
    expect(result).toEqual({ comboCount: 0, damageToEnemy: 0, healAmount: 0 })
  })

  it('3個消しちょうどならコンボボーナス無しでATK分のダメージになる', () => {
    const groups: MatchGroup[] = [
      { element: 'fire', cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }] },
    ]
    const result = computeTurnResult(groups, team)
    expect(result.comboCount).toBe(1)
    expect(result.damageToEnemy).toBe(Math.round(team.atkByElement.fire))
  })

  it('5個消しは3個消しより多くのダメージになる（多消しボーナス）', () => {
    const three: MatchGroup[] = [
      { element: 'fire', cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }] },
    ]
    const five: MatchGroup[] = [
      {
        element: 'fire',
        cells: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
          { row: 0, col: 2 },
          { row: 0, col: 3 },
          { row: 0, col: 4 },
        ],
      },
    ]
    const threeResult = computeTurnResult(three, team)
    const fiveResult = computeTurnResult(five, team)
    expect(fiveResult.damageToEnemy).toBeGreaterThan(threeResult.damageToEnemy)
  })

  it('コンボ数が多いほどダメージが増える（コンボボーナス）', () => {
    const oneCombo: MatchGroup[] = [
      { element: 'fire', cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }] },
    ]
    const twoCombo: MatchGroup[] = [
      ...oneCombo,
      { element: 'fire', cells: [{ row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }] },
    ]
    const oneResult = computeTurnResult(oneCombo, team)
    const twoResult = computeTurnResult(twoCombo, team)
    // 同じ属性の合計マス数が2倍なのに対し、コンボボーナスが乗る分さらにダメージが大きい
    expect(twoResult.damageToEnemy).toBeGreaterThan(oneResult.damageToEnemy * 2)
  })

  it('ハートグループはダメージではなく回復として計算される', () => {
    const groups: MatchGroup[] = [
      { element: 'heart', cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }] },
    ]
    const result = computeTurnResult(groups, team)
    expect(result.damageToEnemy).toBe(0)
    expect(result.healAmount).toBe(Math.round(team.rcv))
  })
})
