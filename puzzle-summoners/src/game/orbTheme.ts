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

export interface EggTheme {
  readonly gradient: string
  readonly glow: string
  /** 4★以上は殻がキラキラと輝き、割る前から期待感を煽る */
  readonly shimmer: boolean
}

/** ガチャの卵の殻の見た目。レアリティが高いほど豪華になり、割る前から期待感を演出する */
export const EGG_THEME: Record<Rarity, EggTheme> = {
  1: {
    gradient: 'radial-gradient(circle at 32% 22%, #fffaf0, #cfc7b8 130%)',
    glow: 'rgba(154, 160, 166, 0.25)',
    shimmer: false,
  },
  2: {
    gradient: 'radial-gradient(circle at 32% 22%, #f3fbe8, #6bb26b 140%)',
    glow: 'rgba(107, 178, 107, 0.3)',
    shimmer: false,
  },
  3: {
    gradient: 'radial-gradient(circle at 32% 22%, #eaf8ff, #4f9de0 140%)',
    glow: 'rgba(79, 157, 224, 0.45)',
    shimmer: false,
  },
  4: {
    gradient: 'radial-gradient(circle at 32% 22%, #f8ecff, #b073e0 150%)',
    glow: 'rgba(176, 115, 224, 0.6)',
    shimmer: true,
  },
  5: {
    gradient: 'radial-gradient(circle at 32% 22%, #fff8dc, #e8b93f 150%)',
    glow: 'rgba(232, 185, 63, 0.8)',
    shimmer: true,
  },
  6: {
    gradient: 'radial-gradient(circle at 32% 22%, #fff0f0, #ff6f6f 150%)',
    glow: 'rgba(255, 111, 111, 0.9)',
    shimmer: true,
  },
}
