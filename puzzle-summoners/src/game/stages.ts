import type { Dungeon } from './types'

export const DUNGEONS: readonly Dungeon[] = [
  {
    id: 'plains',
    name: '初心者の草原',
    description: '駆け出しの召喚士がまず挑む、穏やかな草原のダンジョン。',
    stages: [
      {
        id: 'plains-1',
        name: '草原の見張り',
        recommendedLevel: 1,
        enemy: { name: 'グリーンスライム', element: 'wood', maxHp: 900, atk: 70 },
        stoneReward: 1,
        coinReward: 100,
        firstClearDropId: 'wood-1',
      },
      {
        id: 'plains-2',
        name: '小さな火の玉',
        recommendedLevel: 2,
        enemy: { name: 'ファイアポップ', element: 'fire', maxHp: 1300, atk: 90 },
        stoneReward: 1,
        coinReward: 150,
        firstClearDropId: 'fire-1',
      },
      {
        id: 'plains-3',
        name: '泉の番人',
        recommendedLevel: 3,
        enemy: { name: 'アクアガーディアン', element: 'water', maxHp: 1800, atk: 120 },
        stoneReward: 2,
        coinReward: 200,
        firstClearDropId: 'water-1',
      },
      {
        id: 'plains-4',
        name: '草原のボス・キングスライム',
        recommendedLevel: 4,
        enemy: { name: 'キングスライム', element: 'wood', maxHp: 3000, atk: 260, turnsPerAttack: 3 },
        stoneReward: 3,
        coinReward: 300,
        firstClearDropId: 'wood-2',
      },
    ],
  },
  {
    id: 'cave',
    name: '業火の洞窟',
    description: '灼熱の溶岩が渦巻く洞窟。手強い炎の魔物が待ち構える。',
    stages: [
      {
        id: 'cave-1',
        name: '溶岩トカゲの群れ',
        recommendedLevel: 5,
        enemy: { name: 'ラヴァリザード', element: 'fire', maxHp: 3600, atk: 220 },
        stoneReward: 2,
        coinReward: 350,
        firstClearDropId: 'fire-2',
      },
      {
        id: 'cave-2',
        name: '闇に潜む影',
        recommendedLevel: 6,
        enemy: { name: 'シャドウリーパー', element: 'dark', maxHp: 4500, atk: 260, turnsPerAttack: 2 },
        stoneReward: 2,
        coinReward: 400,
        firstClearDropId: 'dark-2',
      },
      {
        id: 'cave-3',
        name: '光る守護者',
        recommendedLevel: 7,
        enemy: { name: 'ホーリーゴーレム', element: 'light', maxHp: 5600, atk: 300, turnsPerAttack: 2 },
        stoneReward: 3,
        coinReward: 450,
        firstClearDropId: 'light-2',
      },
      {
        id: 'cave-4',
        name: '洞窟のボス・フレイムオーガ',
        recommendedLevel: 9,
        enemy: { name: 'フレイムオーガ', element: 'fire', maxHp: 8000, atk: 560, turnsPerAttack: 3 },
        stoneReward: 5,
        coinReward: 700,
        firstClearDropId: 'fire-3',
      },
    ],
  },
  {
    id: 'castle',
    name: '竜王の城',
    description: '五体の竜皇が眠るという伝説の城。挑む者は皆、力を試される。',
    stages: [
      {
        id: 'castle-1',
        name: '城門の番竜',
        recommendedLevel: 12,
        enemy: { name: 'ゲートドラゴン', element: 'dark', maxHp: 10000, atk: 480, turnsPerAttack: 2 },
        stoneReward: 4,
        coinReward: 900,
        firstClearDropId: 'dark-3',
      },
      {
        id: 'castle-2',
        name: '大広間の騎士団長',
        recommendedLevel: 14,
        enemy: { name: '聖騎士団長ガレス', element: 'light', maxHp: 12000, atk: 560, turnsPerAttack: 2 },
        stoneReward: 4,
        coinReward: 1000,
        firstClearDropId: 'light-3',
      },
      {
        id: 'castle-3',
        name: '玉座の間の魔女',
        recommendedLevel: 16,
        enemy: { name: '氷結の魔女モルガナ', element: 'water', maxHp: 14000, atk: 620, turnsPerAttack: 2 },
        stoneReward: 5,
        coinReward: 1200,
        firstClearDropId: 'water-4',
      },
      {
        id: 'castle-4',
        name: '竜王城最深部の守護竜',
        recommendedLevel: 20,
        enemy: { name: '暗黒竜皇ネメシス（守護竜）', element: 'dark', maxHp: 22000, atk: 1200, turnsPerAttack: 3 },
        stoneReward: 10,
        coinReward: 2000,
        firstClearDropId: 'dark-5',
      },
    ],
  },
]

export const findStage = (stageId: string) => {
  for (const dungeon of DUNGEONS) {
    const stage = dungeon.stages.find((s) => s.id === stageId)
    if (stage) return { dungeon, stage }
  }
  return null
}
