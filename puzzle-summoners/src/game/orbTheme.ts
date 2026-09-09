import type { Element, Rarity, SkillEffect } from './types'

export interface ElementMeta {
  readonly label: string
  readonly color: string
  readonly glow: string
  readonly icon: string
}

export const ELEMENT_META: Record<Element, ElementMeta> = {
  fire: { label: '火', color: '#e64a3f', glow: '#ff8a70', icon: '🔥' },
  water: { label: '水', color: '#2f8fd6', glow: '#7fd4ff', icon: '💧' },
  wood: { label: '木', color: '#3fa15a', glow: '#9be89f', icon: '🌿' },
  light: { label: '光', color: '#d8ae2c', glow: '#fff2a8', icon: '✨' },
  dark: { label: '闇', color: '#7a4fc4', glow: '#c9a8ff', icon: '🌙' },
  heart: { label: '回復', color: '#e0568c', glow: '#ffb3d1', icon: '❤️' },
}

export const SKILL_KIND_ICON: Record<SkillEffect['kind'], string> = {
  damage: '💥',
  heal: '✚',
  boost: '⬆️',
}

export const RARITY_STAR_COLOR: Record<number, string> = {
  1: '#9aa0a6',
  2: '#6bb26b',
  3: '#4f9de0',
  4: '#b073e0',
  5: '#e8b93f',
  6: '#ff6f6f',
}

/**
 * 本家パズドラの卵の種類（通常卵・金卵・ダイヤ卵・虹卵）を再現。
 * 本家では卵の見た目からレアリティの見当がつくようになっている。
 */
export type EggTier = 'normal' | 'gold' | 'diamond' | 'rainbow'

export interface EggTheme {
  readonly label: string
  readonly gradient: string
  readonly glow: string
  readonly shimmer: boolean
}

export const EGG_TIER_BY_RARITY: Record<Rarity, EggTier> = {
  1: 'normal',
  2: 'normal',
  3: 'gold',
  4: 'gold',
  5: 'diamond',
  6: 'rainbow',
}

export const EGG_TIER_THEME: Record<EggTier, EggTheme> = {
  normal: {
    label: '卵',
    gradient: 'radial-gradient(circle at 32% 22%, #fffaf0, #d8d0c0 130%)',
    glow: 'rgba(255, 255, 255, 0.2)',
    shimmer: false,
  },
  gold: {
    label: '金卵',
    gradient: 'radial-gradient(circle at 32% 22%, #fff6d8, #e8b93f 140%)',
    glow: 'rgba(232, 185, 63, 0.55)',
    shimmer: true,
  },
  diamond: {
    label: 'ダイヤの卵',
    gradient: 'radial-gradient(circle at 32% 22%, #ffffff, #8fd9ff 140%)',
    glow: 'rgba(143, 217, 255, 0.75)',
    shimmer: true,
  },
  rainbow: {
    label: '虹卵',
    gradient:
      'radial-gradient(circle at 32% 22%, #ffffff, transparent 60%), conic-gradient(from 180deg, #ff6f6f, #e8b93f, #6bb26b, #4f9de0, #b073e0, #ff6f6f)',
    glow: 'rgba(255, 255, 255, 0.9)',
    shimmer: true,
  },
}

/** 6★（虹卵）は割る直前まで、あえて一段階格下の「ダイヤの卵」に見せて期待感を溜める */
export const initialEggTier = (rarity: Rarity): EggTier => (rarity === 6 ? 'diamond' : EGG_TIER_BY_RARITY[rarity])
