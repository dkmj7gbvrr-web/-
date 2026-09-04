export type Tube = number[]

export const CAPACITY = 4
export const EMPTY_TUBES = 2

export interface Difficulty {
  level: number
  label: string
  colorCount: number
}

export const DIFFICULTIES: Difficulty[] = [
  { level: 1, label: 'かんたん', colorCount: 4 },
  { level: 2, label: 'ふつう', colorCount: 6 },
  { level: 3, label: 'むずかしい', colorCount: 8 },
  { level: 4, label: '激ムズ', colorCount: 12 },
]

export const COLOR_HEX = [
  '#ef4444',
  '#3b82f6',
  '#22c55e',
  '#eab308',
  '#a855f7',
  '#f97316',
  '#ec4899',
  '#06b6d4',
  '#92400e',
  '#64748b',
  '#6366f1',
  '#84cc16',
]

export const COLOR_NAMES = ['赤', '青', '緑', '黄', '紫', '橙', '桃', '水色', '茶', '灰', '藍', '黄緑']
