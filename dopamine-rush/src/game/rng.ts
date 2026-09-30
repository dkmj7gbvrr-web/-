/** [0, 1) を返す乱数関数。テストでは決定的な実装を注入する。 */
export type Rng = () => number

/** 32bit シード付きの軽量 PRNG（mulberry32）。 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 重み付きテーブルから1つ選ぶ。重みの合計は1でなくてもよい。 */
export function pickWeighted<T extends string | number>(
  table: ReadonlyArray<readonly [T, number]>,
  rng: Rng,
): T {
  const total = table.reduce((s, [, w]) => s + w, 0)
  let r = rng() * total
  for (const [value, w] of table) {
    if (r < w) return value
    r -= w
  }
  return table[table.length - 1][0]
}

export function randInt(rng: Rng, minInclusive: number, maxInclusive: number): number {
  return minInclusive + Math.floor(rng() * (maxInclusive - minInclusive + 1))
}
