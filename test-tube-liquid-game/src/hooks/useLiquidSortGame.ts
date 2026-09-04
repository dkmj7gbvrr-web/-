import { useCallback, useEffect, useRef, useState } from 'react'
import { canPour, isSolved, pour } from '../game/engine'
import { generatePuzzle } from '../game/generator'
import { CAPACITY, DIFFICULTIES, EMPTY_TUBES } from '../game/types'
import type { Tube } from '../game/types'

export function useLiquidSortGame() {
  const [level, setLevel] = useState<number | null>(null)
  const [tubes, setTubes] = useState<Tube[] | null>(null)
  const [initialTubes, setInitialTubes] = useState<Tube[] | null>(null)
  const [history, setHistory] = useState<Tube[][]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [moves, setMoves] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const generationToken = useRef(0)

  const won = tubes !== null && isSolved(tubes, CAPACITY)

  const startNewGame = useCallback((targetLevel: number) => {
    const difficulty = DIFFICULTIES.find((d) => d.level === targetLevel)
    if (!difficulty) return
    const token = ++generationToken.current
    setLevel(targetLevel)
    setIsGenerating(true)
    setTubes(null)
    setSelected(null)
    setHistory([])
    setMoves(0)
    setElapsedSeconds(0)
    // Defer generation one frame so the "生成中" state actually paints first.
    window.setTimeout(() => {
      const puzzle = generatePuzzle({
        colorCount: difficulty.colorCount,
        capacity: CAPACITY,
        emptyTubes: EMPTY_TUBES,
      })
      if (generationToken.current !== token) return
      setTubes(puzzle)
      setInitialTubes(puzzle)
      setIsGenerating(false)
    }, 30)
  }, [])

  const backToMenu = useCallback(() => {
    generationToken.current++
    setLevel(null)
    setTubes(null)
    setInitialTubes(null)
    setHistory([])
    setSelected(null)
    setMoves(0)
    setElapsedSeconds(0)
    setIsGenerating(false)
  }, [])

  const selectTube = useCallback(
    (index: number) => {
      if (!tubes || won) return
      if (selected === null) {
        if (tubes[index].length > 0) setSelected(index)
        return
      }
      if (selected === index) {
        setSelected(null)
        return
      }
      if (canPour(tubes[selected], tubes[index], CAPACITY)) {
        const result = pour(tubes[selected], tubes[index], CAPACITY)
        const next = tubes.slice()
        next[selected] = result.source
        next[index] = result.target
        setHistory((h) => [...h, tubes])
        setTubes(next)
        setMoves((m) => m + 1)
        setSelected(null)
        return
      }
      // Invalid target: treat as re-selecting a different source tube when possible.
      setSelected(tubes[index].length > 0 ? index : null)
    },
    [tubes, selected, won],
  )

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      setTubes(prev)
      setMoves((m) => Math.max(0, m - 1))
      setSelected(null)
      return h.slice(0, -1)
    })
  }, [])

  const resetPuzzle = useCallback(() => {
    if (!initialTubes) return
    setTubes(initialTubes)
    setHistory([])
    setMoves(0)
    setSelected(null)
    setElapsedSeconds(0)
  }, [initialTubes])

  useEffect(() => {
    if (!tubes || isGenerating || won) return
    const id = window.setInterval(() => setElapsedSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [tubes, isGenerating, won])

  return {
    level,
    tubes,
    selected,
    moves,
    isGenerating,
    elapsedSeconds,
    won,
    canUndo: history.length > 0,
    startNewGame,
    backToMenu,
    selectTube,
    undo,
    resetPuzzle,
  }
}
