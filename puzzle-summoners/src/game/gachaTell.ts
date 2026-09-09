import type { Rng } from './rng'
import type { Rarity } from './types'

/**
 * ガチャ開封演出の「見せかけの期待度」ランク。
 * 実際の抽選結果（レアリティ）とは別に、演出の煽り具合だけを決めるための値。
 */
export type TellTier = 'low' | 'mid' | 'high' | 'legend'

const TELL_TIER_RANK: Record<TellTier, number> = { low: 0, mid: 1, high: 2, legend: 3 }

export const compareTellTier = (a: TellTier, b: TellTier): number => TELL_TIER_RANK[a] - TELL_TIER_RANK[b]

/**
 * レアリティごとに「どの期待度演出を見せるか」の確率テーブル。
 * 本家パチンコの「信頼度」と同じく、高い期待度の演出（先バレ・保留・リーチ）が出ても
 * 実際にそのレア以上が出るとは限らない（ガセ）し、逆に静かな演出のまま高レアが
 * 出ることもある（隠れ大当たり）。最後まで結果が読めない濃淡を再現するための表で、
 * 実際の抽選確率（RARITY_RATES）には一切影響しない、演出専用の重み。
 */
const TELL_WEIGHTS: Record<Rarity, readonly (readonly [TellTier, number])[]> = {
  1: [
    ['low', 0.9],
    ['mid', 0.08],
    ['high', 0.02],
  ],
  2: [
    ['low', 0.85],
    ['mid', 0.12],
    ['high', 0.03],
  ],
  3: [
    ['low', 0.35],
    ['mid', 0.55],
    ['high', 0.1],
  ],
  4: [
    ['low', 0.15],
    ['mid', 0.55],
    ['high', 0.3],
  ],
  5: [
    ['mid', 0.15],
    ['high', 0.7],
    ['legend', 0.15],
  ],
  6: [
    ['mid', 0.05],
    ['high', 0.15],
    ['legend', 0.8],
  ],
}

/** 演出専用の疑似乱数で「見せかけの期待度」を1つ抽選する。実際の抽選結果には影響しない */
export const rollTellTier = (rng: Rng, actualRarity: Rarity): TellTier => {
  const weights = TELL_WEIGHTS[actualRarity]
  let threshold = rng()
  for (const [tier, weight] of weights) {
    threshold -= weight
    if (threshold < 0) return tier
  }
  return weights[weights.length - 1][0]
}

/** リーチ中に表示する期待度別の煽り文句。lowは無地味なので表示しない */
export const TELL_LABEL: Record<TellTier, string> = {
  low: '',
  mid: 'お？',
  high: '熱い予感…！',
  legend: '来る、これは来る…！！',
}
