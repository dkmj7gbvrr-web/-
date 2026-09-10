import type { Rng } from './types'

/** テスト用の決定的な乱数生成器。渡した数列を順番に返し、尽きたら最後の値を繰り返す。 */
export function queueRng(values: number[]): Rng {
  let i = 0
  return () => {
    const v = values[Math.min(i, values.length - 1)]
    i += 1
    return v
  }
}
