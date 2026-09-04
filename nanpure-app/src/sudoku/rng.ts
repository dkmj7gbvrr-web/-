export type Rng = () => number

/** mulberry32: 軽量な決定的疑似乱数生成器。同じseedから常に同じ数列を生成する */
export const mulberry32 = (seed: number): Rng => {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const randomSeed = (): number => Math.floor(Math.random() * 0xffffffff) >>> 0
