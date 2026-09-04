import type { AttackElement, MonsterDef, Rarity } from './types'

interface RarityStats {
  readonly hp: number
  readonly atk: number
  readonly rcv: number
  readonly leaderMultiplier: number
}

/** レアリティごとの基礎ステータスカーブ。個々のモンスターのレベル成長は持たず、レアリティで強さが決まる */
const STATS_BY_RARITY: Record<Rarity, RarityStats> = {
  1: { hp: 120, atk: 50, rcv: 20, leaderMultiplier: 1.2 },
  2: { hp: 220, atk: 90, rcv: 35, leaderMultiplier: 1.5 },
  3: { hp: 380, atk: 150, rcv: 55, leaderMultiplier: 1.8 },
  4: { hp: 600, atk: 230, rcv: 80, leaderMultiplier: 2.0 },
  5: { hp: 900, atk: 340, rcv: 110, leaderMultiplier: 2.5 },
  6: { hp: 1300, atk: 480, rcv: 150, leaderMultiplier: 3.0 },
}

const ELEMENT_LABEL: Record<AttackElement, string> = {
  fire: '火',
  water: '水',
  wood: '木',
  light: '光',
  dark: '闇',
}

interface RawMonster {
  readonly id: string
  readonly name: string
  readonly element: AttackElement
  readonly rarity: Rarity
  readonly description: string
}

const RAW_MONSTERS: readonly RawMonster[] = [
  // 火
  { id: 'fire-1', name: 'ヒノコゴブリン', element: 'fire', rarity: 1, description: '小さな炎を操るいたずら好きのゴブリン。' },
  { id: 'fire-2', name: 'フレイムウルフ', element: 'fire', rarity: 2, description: '牙から炎を吹く俊敏な狼。' },
  { id: 'fire-3', name: 'サラマンダーナイト', element: 'fire', rarity: 3, description: '灼熱の鎧をまとった炎の騎士。' },
  { id: 'fire-4', name: 'ブレイズジェネラル', element: 'fire', rarity: 4, description: '火竜軍を率いる猛将。' },
  { id: 'fire-5', name: 'フェニックスダンサー', element: 'fire', rarity: 5, description: '舞うたびに炎が蘇る不死鳥の巫女。' },
  { id: 'fire-6', name: '紅蓮竜皇イグニス', element: 'fire', rarity: 6, description: '大地を焼き尽くす紅蓮の竜皇。' },
  // 水
  { id: 'water-1', name: 'しずくスライム', element: 'water', rarity: 1, description: 'ぷるぷると水を纏う人懐っこいスライム。' },
  { id: 'water-2', name: 'アクアマーメイド', element: 'water', rarity: 2, description: '清流に住む歌好きの人魚。' },
  { id: 'water-3', name: 'フロストナイト', element: 'water', rarity: 3, description: '氷の剣を操る寡黙な騎士。' },
  { id: 'water-4', name: '深海の女王ネレイア', element: 'water', rarity: 4, description: '深海を統べる誇り高き女王。' },
  { id: 'water-5', name: '氷結の巫女ユキナ', element: 'water', rarity: 5, description: 'すべてを凍らせる氷の巫女。' },
  { id: 'water-6', name: '蒼海竜皇レヴィア', element: 'water', rarity: 6, description: '大海原を統べる蒼き竜皇。' },
  // 木
  { id: 'wood-1', name: 'リーフフェアリー', element: 'wood', rarity: 1, description: '木の葉に隠れて眠る小さな妖精。' },
  { id: 'wood-2', name: 'マンドレイクの戦士', element: 'wood', rarity: 2, description: '根から生まれた素朴な戦士。' },
  { id: 'wood-3', name: 'フォレストレンジャー', element: 'wood', rarity: 3, description: '森を守る弓の名手。' },
  { id: 'wood-4', name: '大樹の守人ヨルム', element: 'wood', rarity: 4, description: '千年の大樹に宿る守護者。' },
  { id: 'wood-5', name: '森羅の女神シルヴィ', element: 'wood', rarity: 5, description: '森羅万象を司る豊穣の女神。' },
  { id: 'wood-6', name: '翠嵐竜皇ヴェルダ', element: 'wood', rarity: 6, description: '嵐のごとき緑風を纏う竜皇。' },
  // 光
  { id: 'light-1', name: 'ひかりのしずく精', element: 'light', rarity: 1, description: '柔らかな光を放つ小さな精霊。' },
  { id: 'light-2', name: 'セイクリッドナイト', element: 'light', rarity: 2, description: '聖なる誓いを立てた見習い騎士。' },
  { id: 'light-3', name: '聖女ルミナ', element: 'light', rarity: 3, description: '傷ついた者を癒す旅の聖女。' },
  { id: 'light-4', name: '光帝アルテイン', element: 'light', rarity: 4, description: '光の国を治める若き帝王。' },
  { id: 'light-5', name: '大天使ミカエラ', element: 'light', rarity: 5, description: '天界より遣わされた守護の大天使。' },
  { id: 'light-6', name: '光輝竜皇オーレリア', element: 'light', rarity: 6, description: 'すべてを照らす光輝の竜皇。' },
  // 闇
  { id: 'dark-1', name: 'シャドウキャット', element: 'dark', rarity: 1, description: '夜闇に紛れる気まぐれな黒猫。' },
  { id: 'dark-2', name: 'ダークインプ', element: 'dark', rarity: 2, description: '闇の魔力でいたずらをする小悪魔。' },
  { id: 'dark-3', name: '死霊術師ネクロ', element: 'dark', rarity: 3, description: '禁じられた術を操る研究者。' },
  { id: 'dark-4', name: '冥府の公爵ヴァルド', element: 'dark', rarity: 4, description: '冥府に君臨する高潔な公爵。' },
  { id: 'dark-5', name: '堕天使ルシフィア', element: 'dark', rarity: 5, description: '堕ちてなお美しい元天使。' },
  { id: 'dark-6', name: '暗黒竜皇ネメシス', element: 'dark', rarity: 6, description: '世界の理を喰らう暗黒の竜皇。' },
]

export const MONSTERS: readonly MonsterDef[] = RAW_MONSTERS.map((raw) => {
  const stats = STATS_BY_RARITY[raw.rarity]
  return {
    id: raw.id,
    name: raw.name,
    element: raw.element,
    rarity: raw.rarity,
    baseHp: stats.hp,
    baseAtk: stats.atk,
    baseRcv: stats.rcv,
    leaderSkill: {
      element: raw.element,
      multiplier: stats.leaderMultiplier,
      description: `${ELEMENT_LABEL[raw.element]}属性の攻撃力が${stats.leaderMultiplier}倍になる。`,
    },
    description: raw.description,
  }
})

const MONSTER_BY_ID = new Map(MONSTERS.map((m) => [m.id, m]))

export const getMonsterDef = (defId: string): MonsterDef => {
  const def = MONSTER_BY_ID.get(defId)
  if (!def) throw new Error(`unknown monster id: ${defId}`)
  return def
}

export const STARTER_MONSTER_ID = 'fire-3'
