import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MULTI_PULL_COST, MULTI_PULL_COUNT, SINGLE_PULL_COST, multiPull } from '../game/gacha'
import type { PullRecord } from '../game/gacha'
import { getMonsterDef } from '../game/monsters'
import { mulberry32, randomSeed } from '../game/rng'
import { createInitialPlayerState, createUid, loadPlayerState, savePlayerState } from '../game/storage'
import type { MonsterDef, OwnedMonster, PlayerState, Stage } from '../game/types'
import { PARTY_SIZE } from '../game/types'

export interface OwnedMonsterWithDef extends OwnedMonster {
  readonly def: MonsterDef
}

export interface StageClearOutcome {
  readonly victory: boolean
  readonly isFirstClear: boolean
  readonly stoneReward: number
  readonly coinReward: number
  readonly droppedMonster: MonsterDef | null
}

export const useGameState = () => {
  const [player, setPlayer] = useState<PlayerState>(() => loadPlayerState())
  const rngRef = useRef(mulberry32(randomSeed()))

  useEffect(() => {
    savePlayerState(player)
  }, [player])

  const ownedMonsters = useMemo<OwnedMonsterWithDef[]>(
    () => player.ownedMonsters.map((m) => ({ ...m, def: getMonsterDef(m.defId) })),
    [player.ownedMonsters],
  )

  const ownedByUid = useMemo(() => new Map(ownedMonsters.map((m) => [m.uid, m])), [ownedMonsters])

  const partySlots = useMemo<(OwnedMonsterWithDef | null)[]>(
    () => player.party.map((uid) => (uid ? (ownedByUid.get(uid) ?? null) : null)),
    [player.party, ownedByUid],
  )

  const partyMonsterDefs = useMemo<MonsterDef[]>(
    () => partySlots.filter((m): m is OwnedMonsterWithDef => m !== null).map((m) => m.def),
    [partySlots],
  )

  const runPull = useCallback(
    (count: number, cost: number): readonly PullRecord[] | null => {
      if (player.stones < cost) return null
      const { pulls, nextPityCount } = multiPull(rngRef.current, count, player.pullCountSinceRare)
      const newMonsters: OwnedMonster[] = pulls.map((p) => ({ uid: createUid(), defId: p.monster.id }))

      setPlayer((prev) => ({
        ...prev,
        stones: prev.stones - cost,
        ownedMonsters: [...prev.ownedMonsters, ...newMonsters],
        pullCountSinceRare: nextPityCount,
        totalPulls: prev.totalPulls + count,
      }))

      return pulls
    },
    [player.stones, player.pullCountSinceRare],
  )

  const pullSingle = useCallback(() => runPull(1, SINGLE_PULL_COST), [runPull])
  const pullMulti = useCallback(() => runPull(MULTI_PULL_COUNT, MULTI_PULL_COST), [runPull])

  const setPartySlot = useCallback((slotIndex: number, uid: string | null) => {
    setPlayer((prev) => {
      const nextParty = prev.party.slice()
      // 同じモンスターが既に別枠にいたら、そこは空にする（重複配置を避ける）
      for (let i = 0; i < nextParty.length; i++) {
        if (uid !== null && nextParty[i] === uid) nextParty[i] = null
      }
      nextParty[slotIndex] = uid
      return { ...prev, party: nextParty }
    })
  }, [])

  const isStageCleared = useCallback((stageId: string) => player.clearedStageIds.includes(stageId), [player.clearedStageIds])

  const completeStage = useCallback((stage: Stage, victory: boolean): StageClearOutcome => {
    if (!victory) {
      return { victory: false, isFirstClear: false, stoneReward: 0, coinReward: 0, droppedMonster: null }
    }

    let isFirstClear = false
    let droppedMonster: MonsterDef | null = null

    setPlayer((prev) => {
      isFirstClear = !prev.clearedStageIds.includes(stage.id)
      const nextOwned = prev.ownedMonsters.slice()

      if (isFirstClear && stage.firstClearDropId) {
        droppedMonster = getMonsterDef(stage.firstClearDropId)
        nextOwned.push({ uid: createUid(), defId: stage.firstClearDropId })
      }

      return {
        ...prev,
        stones: prev.stones + stage.stoneReward,
        coins: prev.coins + stage.coinReward,
        clearedStageIds: isFirstClear ? [...prev.clearedStageIds, stage.id] : prev.clearedStageIds,
        ownedMonsters: nextOwned,
      }
    })

    return {
      victory: true,
      isFirstClear,
      stoneReward: stage.stoneReward,
      coinReward: stage.coinReward,
      droppedMonster,
    }
  }, [])

  const resetProgress = useCallback(() => {
    setPlayer(createInitialPlayerState())
  }, [])

  return {
    player,
    ownedMonsters,
    partySlots,
    partyMonsterDefs,
    partySize: PARTY_SIZE,
    pullSingle,
    pullMulti,
    singlePullCost: SINGLE_PULL_COST,
    multiPullCost: MULTI_PULL_COST,
    setPartySlot,
    isStageCleared,
    completeStage,
    resetProgress,
  }
}

export type GameStateApi = ReturnType<typeof useGameState>
