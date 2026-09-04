import type { Element, SkillEffect } from './types'

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
