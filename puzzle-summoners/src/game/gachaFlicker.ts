import type { Rng } from './rng'
import type { Rarity } from './types'

export interface FlickerStep {
  readonly rarity: Rarity
  readonly holdMs: number
  /** ルーレットの最終停止（結果確定）かどうか */
  readonly isLock: boolean
}

const TIERS: readonly Rarity[] = [1, 2, 3, 4, 5, 6]

/** レアリティごとの「グルグル回る」ステップ数。レア度が高いほど長く粘って期待感を煽る */
const STEP_COUNT_BY_RARITY: Record<Rarity, number> = {
  1: 6,
  2: 6,
  3: 8,
  4: 11,
  5: 14,
  6: 18,
}

const pick = <T,>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)]

/**
 * 卵の殻の色が確定するまでの「ルーレット」演出のステップ列を組み立てる。
 * 最終レアリティが高いほど長く回り、金・赤などの高レア色を一度は匂わせてから
 * 外れて別の色に変わる…という「寸止め」を挟むことで、割れるまで結果が分からないようにする。
 * （最終ステップだけは必ずfinalRarityで確定＝ロックインする）
 */
export const buildFlickerPlan = (finalRarity: Rarity, rng: Rng): readonly FlickerStep[] => {
  const stepCount = STEP_COUNT_BY_RARITY[finalRarity]
  const steps: FlickerStep[] = []

  for (let i = 0; i < stepCount - 1; i++) {
    const progress = i / Math.max(1, stepCount - 2)
    // 序盤は高速、終盤に向けてゆっくりになる（ルーレットが減速していくイメージ）
    const holdMs = Math.round(45 + progress * progress * 230)

    // 「高レア色をちらつかせる」確率。最終レアリティが高いほど、また終盤に近いほど上がる
    const temptChance = 0.12 + (finalRarity / 6) * 0.3 + progress * 0.25
    let rarity: Rarity
    if (rng() < temptChance) {
      rarity = rng() < 0.5 ? 5 : 6
    } else {
      rarity = pick(rng, TIERS)
    }

    steps.push({ rarity, holdMs, isLock: false })
  }

  steps.push({ rarity: finalRarity, holdMs: 320 + finalRarity * 40, isLock: true })
  return steps
}
