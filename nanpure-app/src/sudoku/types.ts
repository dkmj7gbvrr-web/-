/** 1〜9の数字（0は空欄を表す） */
export type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

/** 81マス分の数字を row-major（行優先）で格納した盤面 */
export type Grid = Digit[]

export type Difficulty = 1 | 2 | 3 | 4 | 5

export interface DifficultyInfo {
  level: Difficulty
  label: string
  description: string
}

export const DIFFICULTIES: DifficultyInfo[] = [
  { level: 1, label: '初級', description: '空いているマスを見れば数字が一つに決まる、基本の解き方だけで解けます。' },
  { level: 2, label: '中級', description: '候補を絞り込む基本テクニックが必要になります。' },
  { level: 3, label: '上級', description: '複数マスの候補を組み合わせて絞り込む、少し高度なテクニックが必要です。' },
  { level: 4, label: '超上級', description: 'X-Wingなど、行と列をまたいだ高度なテクニックが必要です。' },
  { level: 5, label: '最難関', description: '手がかりが少なく、深い論理的推理が要求される最高難度です。' },
]

/** 技巧のティア（数字が大きいほど高度）。0=未着手 */
export type TechniqueTier = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface TechniqueDef {
  id: string
  tier: TechniqueTier
  name: string
}

/** ヒントで示す1手分の論理ステップ */
export interface HintStep {
  techniqueId: string
  techniqueName: string
  tier: TechniqueTier
  /** このステップで確定できるマス（naked/hidden single 等）。無ければ候補除外のみのステップ */
  fill?: { index: number; digit: Digit }
  /** 候補から除外できる (index, digit) の一覧 */
  eliminations: { index: number; digit: Digit }[]
  /** 根拠として強調表示すべきマス */
  highlightCells: number[]
  /** 根拠として強調表示すべき候補 (index, digit) */
  highlightCandidates: { index: number; digit: Digit }[]
  /** ユーザー向けの日本語説明文 */
  explanation: string
}

export interface GeneratedPuzzle {
  puzzle: Grid
  solution: Grid
  difficulty: Difficulty
  givenCount: number
  ratedTier: TechniqueTier
  /** この問題を再現するための乱数seed（同じ難易度・同じseedなら常に同一の問題になる） */
  seed: number
}
