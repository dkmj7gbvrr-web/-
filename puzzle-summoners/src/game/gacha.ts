import { MONSTERS } from './monsters'
import type { Rng } from './rng'
import { pickInt } from './rng'
import type { MonsterDef, Rarity } from './types'

/** レアリティ別の排出率（%）。合計は必ず100になる */
export const RARITY_RATES: Record<Rarity, number> = {
  1: 40,
  2: 30,
  3: 18,
  4: 8,
  5: 3,
  6: 1,
}

export const SINGLE_PULL_COST = 5
export const MULTI_PULL_COUNT = 10
export const MULTI_PULL_COST = 45

/** 天井（毎ガチャ通算）。このカウントに達すると次の1回は5★以上が確定する */
export const PITY_THRESHOLD = 50

const RARITIES: readonly Rarity[] = [1, 2, 3, 4, 5, 6]

const monstersByRarity: Record<Rarity, readonly MonsterDef[]> = {
  1: MONSTERS.filter((m) => m.rarity === 1),
  2: MONSTERS.filter((m) => m.rarity === 2),
  3: MONSTERS.filter((m) => m.rarity === 3),
  4: MONSTERS.filter((m) => m.rarity === 4),
  5: MONSTERS.filter((m) => m.rarity === 5),
  6: MONSTERS.filter((m) => m.rarity === 6),
}

/** rates（合計100想定）に従ってレアリティを1つ抽選する */
export const rollRarity = (rng: Rng, rates: Record<Rarity, number> = RARITY_RATES): Rarity => {
  const total = RARITIES.reduce((sum, r) => sum + rates[r], 0)
  let threshold = rng() * total
  for (const rarity of RARITIES) {
    threshold -= rates[rarity]
    if (threshold < 0) return rarity
  }
  return RARITIES[RARITIES.length - 1]
}

/** minRarity以上のレアリティのみを対象に、比率を再正規化して抽選する（保証枠・天井用） */
export const rollRarityAtLeast = (
  rng: Rng,
  minRarity: Rarity,
  rates: Record<Rarity, number> = RARITY_RATES,
): Rarity => {
  const candidates = RARITIES.filter((r) => r >= minRarity)
  const total = candidates.reduce((sum, r) => sum + rates[r], 0)
  let threshold = rng() * total
  for (const rarity of candidates) {
    threshold -= rates[rarity]
    if (threshold < 0) return rarity
  }
  return candidates[candidates.length - 1]
}

const pickMonsterOfRarity = (rng: Rng, rarity: Rarity): MonsterDef => {
  const pool = monstersByRarity[rarity]
  return pool[pickInt(rng, pool.length)]
}

export const singlePull = (rng: Rng, forceMinRarity?: Rarity): MonsterDef => {
  const rarity = forceMinRarity ? rollRarityAtLeast(rng, forceMinRarity) : rollRarity(rng)
  return pickMonsterOfRarity(rng, rarity)
}

export interface PullRecord {
  readonly monster: MonsterDef
  /** この個体を引いた時点で天井（保証）が発動したか */
  readonly pityTriggered: boolean
}

export interface MultiPullResult {
  readonly pulls: readonly PullRecord[]
  /** 次回ガチャに引き継ぐ天井カウント */
  readonly nextPityCount: number
}

/**
 * count連ガチャを引く。
 * - count>=10のときは最低1体4★以上が確定する（10連保証）。
 * - 通算天井カウントがPITY_THRESHOLDに達した回は5★以上が確定し、カウントがリセットされる。
 */
export const multiPull = (
  rng: Rng,
  count: number = MULTI_PULL_COUNT,
  startingPityCount: number = 0,
): MultiPullResult => {
  const guaranteeSlot = count >= 10 ? pickInt(rng, count) : -1
  const pulls: PullRecord[] = []
  let hasRareOrBetter = false
  let pity = startingPityCount

  for (let i = 0; i < count; i++) {
    const pityWillTrigger = pity + 1 >= PITY_THRESHOLD
    const isGuaranteeChance = i === count - 1 && guaranteeSlot >= 0 && !hasRareOrBetter

    let rarity: Rarity
    if (pityWillTrigger) {
      rarity = rollRarityAtLeast(rng, 5)
    } else if (isGuaranteeChance) {
      rarity = rollRarityAtLeast(rng, 4)
    } else {
      rarity = rollRarity(rng)
    }

    if (rarity >= 4) hasRareOrBetter = true
    pity = rarity >= 5 ? 0 : pity + 1

    pulls.push({ monster: pickMonsterOfRarity(rng, rarity), pityTriggered: pityWillTrigger })
  }

  return { pulls, nextPityCount: pity }
}
