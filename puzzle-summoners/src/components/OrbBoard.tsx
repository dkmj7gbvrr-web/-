import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Board, FallingOrb, Position } from '../game/board'
import { swapCells } from '../game/board'
import { ELEMENT_META } from '../game/orbTheme'

const DRAG_TIME_MS = 5000

export type OrbAnimState = 'highlight' | 'clearing' | 'popping'

export interface FallLayerOrb {
  readonly id: string
  readonly element: FallingOrb['element']
  readonly row: number
  readonly col: number
}

interface OrbBoardProps {
  readonly board: Board
  readonly disabled: boolean
  readonly onDragEnd: (finalBoard: Board) => void
  /** マス "row-col" ごとの演出状態（コンボ消去のハイライト・消去・出現アニメーション用） */
  readonly cellAnim?: ReadonlyMap<string, OrbAnimState>
  /**
   * 落下アニメーション専用のレイヤー。指定している間は通常の盤面表示の代わりにこちらを描画する。
   * オーブの識別子（id）でReactのkeyを与えることで、マス位置ではなく「そのオーブ自身」が
   * 滑らかに移動するCSSトランジションを実現している。
   */
  readonly fallLayer?: readonly FallLayerOrb[] | null
}

const stepToward = (from: Position, to: Position): Position => {
  if (from.row !== to.row) {
    return { row: from.row + Math.sign(to.row - from.row), col: from.col }
  }
  return { row: from.row, col: from.col + Math.sign(to.col - from.col) }
}

interface SlotStyle {
  readonly width: string
  readonly height: string
  readonly transform: string
}

const slotStyle = (row: number, col: number, widthPct: number, heightPct: number): SlotStyle => ({
  width: `${widthPct}%`,
  height: `${heightPct}%`,
  transform: `translate(${col * 100}%, ${row * 100}%)`,
})

export const OrbBoard = ({ board, disabled, onDragEnd, cellAnim, fallLayer }: OrbBoardProps) => {
  // 親から渡された盤面（ターン確定後の新しい盤面）が変わったら表示を追従させる
  const [syncedBoard, setSyncedBoard] = useState(board)
  const [displayBoard, setDisplayBoard] = useState<Board>(board)
  if (board !== syncedBoard) {
    setSyncedBoard(board)
    setDisplayBoard(board)
  }

  const [draggingPos, setDraggingPos] = useState<Position | null>(null)
  const [timeLeftRatio, setTimeLeftRatio] = useState(1)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef<Position | null>(null)
  const boardRef = useRef<Board>(board)
  const deadlineRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  const endDrag = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (draggingRef.current === null) return
    draggingRef.current = null
    setDraggingPos(null)
    setTimeLeftRatio(1)
    onDragEnd(boardRef.current)
  }

  const tick = (timestamp: number) => {
    if (deadlineRef.current === null) deadlineRef.current = timestamp + DRAG_TIME_MS
    const remaining = deadlineRef.current - timestamp
    setTimeLeftRatio(Math.max(0, remaining / DRAG_TIME_MS))
    if (remaining <= 0) {
      endDrag()
      return
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const cellFromPoint = (clientX: number, clientY: number): Position | null => {
    const el = containerRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const rows = board.length
    const cols = board[0]?.length ?? 0
    if (cols === 0 || rows === 0) return null
    const x = clientX - rect.left
    const y = clientY - rect.top
    if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null
    const col = Math.min(cols - 1, Math.floor((x / rect.width) * cols))
    const row = Math.min(rows - 1, Math.floor((y / rect.height) * rows))
    return { row, col }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return
    const pos = cellFromPoint(event.clientX, event.clientY)
    if (!pos) return
    event.currentTarget.setPointerCapture(event.pointerId)
    draggingRef.current = pos
    boardRef.current = displayBoard
    setDraggingPos(pos)
    deadlineRef.current = null
    rafRef.current = requestAnimationFrame(tick)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (draggingRef.current === null) return
    const target = cellFromPoint(event.clientX, event.clientY)
    if (!target) return

    let current = draggingRef.current
    let nextBoard = boardRef.current
    let guard = 0
    while ((current.row !== target.row || current.col !== target.col) && guard < 20) {
      const step = stepToward(current, target)
      nextBoard = swapCells(nextBoard, current, step)
      current = step
      guard++
    }

    if (guard > 0) {
      draggingRef.current = current
      boardRef.current = nextBoard
      setDisplayBoard(nextBoard)
      setDraggingPos(current)
    }
  }

  const handlePointerUp = () => {
    endDrag()
  }

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const rows = displayBoard.length
  const cols = displayBoard[0]?.length ?? 0
  const cellWidthPct = 100 / cols
  const cellHeightPct = 100 / rows

  return (
    <div className="orb-board-wrapper">
      <div className="orb-timer-track">
        <div className="orb-timer-fill" style={{ width: `${timeLeftRatio * 100}%` }} />
      </div>
      <div
        ref={containerRef}
        className={`orb-board${disabled ? ' orb-board--disabled' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {fallLayer
          ? fallLayer.map((orb) => {
              const meta = ELEMENT_META[orb.element]
              return (
                <div key={orb.id} className="orb-slot orb-slot--falling" style={slotStyle(orb.row, orb.col, cellWidthPct, cellHeightPct)}>
                  <div className="orb" style={{ background: `radial-gradient(circle at 35% 30%, ${meta.glow}, ${meta.color})` }}>
                    <span>{meta.icon}</span>
                  </div>
                </div>
              )
            })
          : displayBoard.map((rowCells, row) =>
              rowCells.map((cell, col) => {
                if (cell === null) return null
                const meta = ELEMENT_META[cell]
                const isDragging = draggingPos?.row === row && draggingPos?.col === col
                const anim = cellAnim?.get(`${row}-${col}`)
                return (
                  <div key={`${row}-${col}`} className="orb-slot" style={slotStyle(row, col, cellWidthPct, cellHeightPct)}>
                    <div
                      className={`orb${isDragging ? ' orb--dragging' : ''}${anim ? ` orb--${anim}` : ''}`}
                      style={{ background: `radial-gradient(circle at 35% 30%, ${meta.glow}, ${meta.color})` }}
                    >
                      <span>{meta.icon}</span>
                    </div>
                  </div>
                )
              }),
            )}
      </div>
    </div>
  )
}
