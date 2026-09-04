export const ELEMENTS = ['fire', 'water', 'wood', 'light', 'dark'] as const
export type AttackElement = (typeof ELEMENTS)[number]
export type Element = AttackElement | 'heart'

export const ALL_ORB_ELEMENTS: readonly Element[] = [...ELEMENTS, 'heart']

export type Rarity = 1 | 2 | 3 | 4 | 5 | 6

export interface LeaderSkill {
  readonly name: string
  readonly element: AttackElement
  /** その属性の攻撃力に掛かる倍率 */
  readonly multiplier: number
  readonly description: string
}

export type SkillEffect =
  | { readonly kind: 'damage'; readonly amount: number }
  | { readonly kind: 'heal'; readonly amount: number }
  | { readonly kind: 'boost'; readonly element: AttackElement; readonly multiplier: number }

export interface ActiveSkill {
  readonly name: string
  readonly description: string
  /** 使用後、再度使えるようになるまでのターン数 */
  readonly maxCooldown: number
  readonly effect: SkillEffect
}

export interface MonsterDef {
  readonly id: string
  readonly name: string
  readonly element: AttackElement
  readonly rarity: Rarity
  readonly baseHp: number
  readonly baseAtk: number
  readonly baseRcv: number
  readonly leaderSkill: LeaderSkill
  readonly activeSkill: ActiveSkill
  readonly description: string
}

export interface OwnedMonster {
  readonly uid: string
  readonly defId: string
}

export interface Enemy {
  readonly name: string
  readonly element: AttackElement
  readonly maxHp: number
  readonly atk: number
}

export interface Stage {
  readonly id: string
  readonly name: string
  readonly recommendedLevel: number
  readonly enemy: Enemy
  readonly stoneReward: number
  readonly coinReward: number
  /** 初回クリア時にドロップするモンスターID（任意） */
  readonly firstClearDropId?: string
}

export interface Dungeon {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly stages: readonly Stage[]
}

export interface PlayerState {
  readonly stones: number
  readonly coins: number
  readonly ownedMonsters: readonly OwnedMonster[]
  /** パーティ編成。先頭がリーダー */
  readonly party: readonly (string | null)[]
  readonly clearedStageIds: readonly string[]
  readonly pullCountSinceRare: number
  readonly totalPulls: number
}

export const PARTY_SIZE = 5
