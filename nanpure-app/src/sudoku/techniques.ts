import {
  BOXES,
  COLS,
  PEERS,
  ROWS,
  bitsToDigits,
  boxLabel,
  cellLabel,
  colLabel,
  computeCandidates,
  digitBit,
  popcount,
  rowLabel,
} from './board'
import type { CandidateMap } from './board'
import type { Digit, Grid, HintStep, TechniqueTier } from './types'

type Unit = { cells: number[]; label: string }

const rowUnits: Unit[] = ROWS.map((cells, r) => ({ cells, label: rowLabel(r) }))
const colUnits: Unit[] = COLS.map((cells, c) => ({ cells, label: colLabel(c) }))
const boxUnits: Unit[] = BOXES.map((cells, b) => ({ cells, label: boxLabel(b) }))
const allUnits: Unit[] = [...rowUnits, ...colUnits, ...boxUnits]

const emptyCellsOf = (grid: Grid, cells: number[]): number[] => cells.filter((c) => grid[c] === 0)

const combinations = <T,>(items: T[], k: number): T[][] => {
  if (k === 0) return [[]]
  if (items.length < k) return []
  const [first, ...rest] = items
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c])
  const withoutFirst = combinations(rest, k)
  return [...withFirst, ...withoutFirst]
}

// ---------- Tier 1: Naked Single / Hidden Single ----------

const findNakedSingle = (grid: Grid, candidates: CandidateMap): HintStep | null => {
  for (let i = 0; i < candidates.length; i++) {
    if (grid[i] !== 0) continue
    const mask = candidates[i]
    if (popcount(mask) === 1) {
      const digit = bitsToDigits(mask)[0]
      return {
        techniqueId: 'naked-single',
        techniqueName: '単一候補（ネイキッドシングル）',
        tier: 1,
        fill: { index: i, digit },
        eliminations: [],
        highlightCells: [i],
        highlightCandidates: [{ index: i, digit }],
        explanation: `${cellLabel(i)}は、同じ行・列・ブロックに入っている数字を除くと候補が「${digit}」だけになります。したがって${cellLabel(i)}は${digit}に決まります。`,
      }
    }
  }
  return null
}

const findHiddenSingle = (grid: Grid, candidates: CandidateMap): HintStep | null => {
  for (const unit of allUnits) {
    for (let d = 1 as Digit; d <= 9; d++) {
      const bit = digitBit(d)
      const cellsWithD = unit.cells.filter((c) => grid[c] === 0 && candidates[c] & bit)
      if (cellsWithD.length === 1) {
        const target = cellsWithD[0]
        return {
          techniqueId: 'hidden-single',
          techniqueName: '隠れ単一候補（ヒドゥンシングル）',
          tier: 1,
          fill: { index: target, digit: d },
          eliminations: [],
          highlightCells: [target],
          highlightCandidates: [{ index: target, digit: d }],
          explanation: `${unit.label}の中で、数字「${d}」が入る候補を持つマスは${cellLabel(target)}だけです。他のマスには候補として${d}が残っていないため、${cellLabel(target)}は${d}に決まります。`,
        }
      }
    }
  }
  return null
}

// ---------- Tier 2: Locked Candidates (Pointing / Claiming) ----------

const findPointing = (grid: Grid, candidates: CandidateMap): HintStep | null => {
  for (let b = 0; b < boxUnits.length; b++) {
    const box = boxUnits[b]
    for (let d = 1 as Digit; d <= 9; d++) {
      const bit = digitBit(d)
      const cellsWithD = emptyCellsOf(grid, box.cells).filter((c) => candidates[c] & bit)
      if (cellsWithD.length < 2) continue

      const rows = new Set(cellsWithD.map((c) => Math.floor(c / 9)))
      const cols = new Set(cellsWithD.map((c) => c % 9))

      if (rows.size === 1) {
        const r = [...rows][0]
        const eliminations = ROWS[r]
          .filter((c) => !box.cells.includes(c) && grid[c] === 0 && candidates[c] & bit)
          .map((index) => ({ index, digit: d }))
        if (eliminations.length > 0) {
          return {
            techniqueId: 'pointing',
            techniqueName: 'ポインティング（ブロック内の候補の集中）',
            tier: 2,
            eliminations,
            highlightCells: cellsWithD,
            highlightCandidates: cellsWithD.map((index) => ({ index, digit: d })),
            explanation: `${box.label}の中で、数字「${d}」の候補は${rowLabel(r)}のマスにしかありません。そのため${rowLabel(r)}の${box.label}以外のマスからは、候補「${d}」を除外できます。`,
          }
        }
      }

      if (cols.size === 1) {
        const c = [...cols][0]
        const eliminations = COLS[c]
          .filter((cell) => !box.cells.includes(cell) && grid[cell] === 0 && candidates[cell] & bit)
          .map((index) => ({ index, digit: d }))
        if (eliminations.length > 0) {
          return {
            techniqueId: 'pointing',
            techniqueName: 'ポインティング（ブロック内の候補の集中）',
            tier: 2,
            eliminations,
            highlightCells: cellsWithD,
            highlightCandidates: cellsWithD.map((index) => ({ index, digit: d })),
            explanation: `${box.label}の中で、数字「${d}」の候補は${colLabel(c)}のマスにしかありません。そのため${colLabel(c)}の${box.label}以外のマスからは、候補「${d}」を除外できます。`,
          }
        }
      }
    }
  }
  return null
}

const findClaiming = (grid: Grid, candidates: CandidateMap): HintStep | null => {
  for (const unit of [...rowUnits, ...colUnits]) {
    for (let d = 1 as Digit; d <= 9; d++) {
      const bit = digitBit(d)
      const cellsWithD = emptyCellsOf(grid, unit.cells).filter((c) => candidates[c] & bit)
      if (cellsWithD.length < 2) continue

      const boxes = new Set(cellsWithD.map((c) => {
        const r = Math.floor(c / 9)
        const col = c % 9
        return Math.floor(r / 3) * 3 + Math.floor(col / 3)
      }))
      if (boxes.size !== 1) continue

      const b = [...boxes][0]
      const eliminations = BOXES[b]
        .filter((c) => !unit.cells.includes(c) && grid[c] === 0 && candidates[c] & bit)
        .map((index) => ({ index, digit: d }))
      if (eliminations.length > 0) {
        return {
          techniqueId: 'claiming',
          techniqueName: 'クレーミング（行・列内の候補の集中）',
          tier: 2,
          eliminations,
          highlightCells: cellsWithD,
          highlightCandidates: cellsWithD.map((index) => ({ index, digit: d })),
          explanation: `${unit.label}の中で、数字「${d}」の候補は${boxLabel(b)}のマスにしかありません。そのため${boxLabel(b)}の${unit.label}以外のマスからは、候補「${d}」を除外できます。`,
        }
      }
    }
  }
  return null
}

// ---------- Tier 3: Naked Pair / Hidden Pair ----------

const findNakedSubset = (
  grid: Grid,
  candidates: CandidateMap,
  size: 2 | 3,
): HintStep | null => {
  const techniqueId = size === 2 ? 'naked-pair' : 'naked-triple'
  const techniqueName = size === 2 ? 'ネイキッドペア' : 'ネイキッドトリプル'
  const tier: TechniqueTier = size === 2 ? 3 : 4
  const kanji = size === 2 ? '2つ' : '3つ'

  for (const unit of allUnits) {
    const cells = emptyCellsOf(grid, unit.cells).filter((c) => {
      const n = popcount(candidates[c])
      return n >= 2 && n <= size
    })
    if (cells.length < size) continue

    for (const combo of combinations(cells, size)) {
      let unionMask = 0
      for (const c of combo) unionMask |= candidates[c]
      if (popcount(unionMask) !== size) continue

      const digits = bitsToDigits(unionMask)
      const others = unit.cells.filter((c) => grid[c] === 0 && !combo.includes(c))
      const eliminations: { index: number; digit: Digit }[] = []
      for (const c of others) {
        for (const d of digits) {
          if (candidates[c] & digitBit(d)) eliminations.push({ index: c, digit: d })
        }
      }
      if (eliminations.length === 0) continue

      return {
        techniqueId,
        techniqueName,
        tier,
        eliminations,
        highlightCells: combo,
        highlightCandidates: combo.flatMap((index) =>
          digits.map((digit) => ({ index, digit })),
        ),
        explanation: `${unit.label}の${combo.map(cellLabel).join('と')}は、候補が「${digits.join('・')}」の${kanji}の数字だけに限られています。この${kanji}の数字は${unit.label}の他のどこかにこの${size}マスの形で必ず入るため、${unit.label}の他のマスからは候補「${digits.join('・')}」を除外できます。`,
      }
    }
  }
  return null
}

const findHiddenSubset = (
  grid: Grid,
  candidates: CandidateMap,
  size: 2 | 3,
): HintStep | null => {
  const techniqueId = size === 2 ? 'hidden-pair' : 'hidden-triple'
  const techniqueName = size === 2 ? 'ヒドゥンペア' : 'ヒドゥントリプル'
  const tier: TechniqueTier = size === 2 ? 3 : 4
  const kanji = size === 2 ? '2つ' : '3つ'

  for (const unit of allUnits) {
    const emptyCells = emptyCellsOf(grid, unit.cells)
    if (emptyCells.length <= size) continue

    const digitsPresent = Array.from({ length: 9 }, (_, idx) => (idx + 1) as Digit).filter(
      (d) => emptyCells.some((c) => candidates[c] & digitBit(d)),
    )

    for (const digitCombo of combinations(digitsPresent, size)) {
      const comboMask = digitCombo.reduce<number>((m, d) => m | digitBit(d), 0)
      const cellsForCombo = emptyCells.filter((c) => candidates[c] & comboMask)
      if (cellsForCombo.length !== size) continue
      // それぞれの数字が、この size マス「以外」に出現していないことを確認
      const confined = digitCombo.every(
        (d) => emptyCells.filter((c) => candidates[c] & digitBit(d)).length <= size,
      )
      if (!confined) continue

      const eliminations: { index: number; digit: Digit }[] = []
      for (const c of cellsForCombo) {
        const extra = candidates[c] & ~comboMask
        for (const d of bitsToDigits(extra)) eliminations.push({ index: c, digit: d })
      }
      if (eliminations.length === 0) continue

      return {
        techniqueId,
        techniqueName,
        tier,
        eliminations,
        highlightCells: cellsForCombo,
        highlightCandidates: cellsForCombo.flatMap((index) =>
          digitCombo.map((digit) => ({ index, digit })),
        ),
        explanation: `${unit.label}の中で、数字「${digitCombo.join('・')}」の${kanji}は${cellsForCombo
          .map(cellLabel)
          .join('と')}にしか入りません。そのためこの${size}マスは他の候補を除外でき、「${digitCombo.join('・')}」以外の候補を消せます。`,
      }
    }
  }
  return null
}

// ---------- Tier 5: X-Wing ----------

const findXWing = (grid: Grid, candidates: CandidateMap): HintStep | null => {
  for (let d = 1 as Digit; d <= 9; d++) {
    const bit = digitBit(d)

    // 行ベース: 2つの行で候補位置が同じ2列に限られる場合
    const rowCandCols: number[][] = ROWS.map((cells) =>
      cells.filter((c) => grid[c] === 0 && candidates[c] & bit).map((c) => c % 9),
    )
    for (let r1 = 0; r1 < 9; r1++) {
      if (rowCandCols[r1].length !== 2) continue
      for (let r2 = r1 + 1; r2 < 9; r2++) {
        if (rowCandCols[r2].length !== 2) continue
        if (rowCandCols[r1][0] !== rowCandCols[r2][0] || rowCandCols[r1][1] !== rowCandCols[r2][1]) continue
        const [c1, c2] = rowCandCols[r1]
        const involved = [r1, r2].flatMap((r) => [c1, c2].map((c) => r * 9 + c))
        const eliminations: { index: number; digit: Digit }[] = []
        for (const c of [c1, c2]) {
          for (const cell of COLS[c]) {
            const r = Math.floor(cell / 9)
            if (r === r1 || r === r2) continue
            if (grid[cell] === 0 && candidates[cell] & bit) eliminations.push({ index: cell, digit: d })
          }
        }
        if (eliminations.length === 0) continue
        return {
          techniqueId: 'x-wing-row',
          techniqueName: 'X-Wing',
          tier: 5,
          eliminations,
          highlightCells: involved,
          highlightCandidates: involved.map((index) => ({ index, digit: d })),
          explanation: `${rowLabel(r1)}と${rowLabel(r2)}では、数字「${d}」の候補がどちらも${colLabel(c1)}と${colLabel(c2)}の2マスだけに限られ、長方形（X-Wing）の形になっています。この4マスのどこかに必ず${d}が入る組み合わせが決まるため、${colLabel(c1)}と${colLabel(c2)}の他のマス（${rowLabel(r1)}・${rowLabel(r2)}以外）からは候補「${d}」を除外できます。`,
        }
      }
    }

    // 列ベース: 2つの列で候補位置が同じ2行に限られる場合
    const colCandRows: number[][] = COLS.map((cells) =>
      cells.filter((c) => grid[c] === 0 && candidates[c] & bit).map((c) => Math.floor(c / 9)),
    )
    for (let c1 = 0; c1 < 9; c1++) {
      if (colCandRows[c1].length !== 2) continue
      for (let c2 = c1 + 1; c2 < 9; c2++) {
        if (colCandRows[c2].length !== 2) continue
        if (colCandRows[c1][0] !== colCandRows[c2][0] || colCandRows[c1][1] !== colCandRows[c2][1]) continue
        const [r1, r2] = colCandRows[c1]
        const involved = [c1, c2].flatMap((c) => [r1, r2].map((r) => r * 9 + c))
        const eliminations: { index: number; digit: Digit }[] = []
        for (const r of [r1, r2]) {
          for (const cell of ROWS[r]) {
            const c = cell % 9
            if (c === c1 || c === c2) continue
            if (grid[cell] === 0 && candidates[cell] & bit) eliminations.push({ index: cell, digit: d })
          }
        }
        if (eliminations.length === 0) continue
        return {
          techniqueId: 'x-wing-col',
          techniqueName: 'X-Wing',
          tier: 5,
          eliminations,
          highlightCells: involved,
          highlightCandidates: involved.map((index) => ({ index, digit: d })),
          explanation: `${colLabel(c1)}と${colLabel(c2)}では、数字「${d}」の候補がどちらも${rowLabel(r1)}と${rowLabel(r2)}の2マスだけに限られ、長方形（X-Wing）の形になっています。この4マスのどこかに必ず${d}が入る組み合わせが決まるため、${rowLabel(r1)}と${rowLabel(r2)}の他のマス（${colLabel(c1)}・${colLabel(c2)}以外）からは候補「${d}」を除外できます。`,
        }
      }
    }
  }
  return null
}

// ---------- Tier 5: XY-Wing ----------

const findXyWing = (grid: Grid, candidates: CandidateMap): HintStep | null => {
  const bivalueCells: number[] = []
  for (let i = 0; i < 81; i++) {
    if (grid[i] === 0 && popcount(candidates[i]) === 2) bivalueCells.push(i)
  }

  for (const pivot of bivalueCells) {
    const [x, y] = bitsToDigits(candidates[pivot])
    const peersOfPivot = PEERS[pivot].filter((c) => bivalueCells.includes(c))

    const wingsForX = peersOfPivot.filter((c) => {
      const digits = bitsToDigits(candidates[c])
      return digits.includes(x) && !digits.includes(y)
    })
    const wingsForY = peersOfPivot.filter((c) => {
      const digits = bitsToDigits(candidates[c])
      return digits.includes(y) && !digits.includes(x)
    })

    for (const wingA of wingsForX) {
      const zFromA = bitsToDigits(candidates[wingA]).find((d) => d !== x)
      if (zFromA === undefined) continue
      for (const wingB of wingsForY) {
        if (wingB === wingA) continue
        const digitsB = bitsToDigits(candidates[wingB])
        if (!digitsB.includes(zFromA) || digitsB.includes(x)) continue
        const z = zFromA

        const zBit = digitBit(z)
        const eliminations = PEERS[wingA]
          .filter((c) => PEERS[wingB].includes(c) && c !== pivot && grid[c] === 0 && candidates[c] & zBit)
          .map((index) => ({ index, digit: z }))
        if (eliminations.length === 0) continue

        return {
          techniqueId: 'xy-wing',
          techniqueName: 'XY-Wing',
          tier: 5,
          eliminations,
          highlightCells: [pivot, wingA, wingB],
          highlightCandidates: [
            { index: pivot, digit: x },
            { index: pivot, digit: y },
            { index: wingA, digit: x },
            { index: wingA, digit: z },
            { index: wingB, digit: y },
            { index: wingB, digit: z },
          ],
          explanation: `${cellLabel(pivot)}（候補${x}・${y}）を軸に、${cellLabel(wingA)}（候補${x}・${z}）と${cellLabel(wingB)}（候補${y}・${z}）を見ると、${cellLabel(pivot)}が${x}なら${cellLabel(wingA)}が${z}に、${cellLabel(pivot)}が${y}なら${cellLabel(wingB)}が${z}になります。どちらにしても${cellLabel(wingA)}と${cellLabel(wingB)}の少なくとも一方は${z}になるため、両方を見ているマスからは候補「${z}」を除外できます。`,
        }
      }
    }
  }
  return null
}

const TECHNIQUES: Array<(grid: Grid, candidates: CandidateMap) => HintStep | null> = [
  findNakedSingle,
  findHiddenSingle,
  findPointing,
  findClaiming,
  (g, c) => findNakedSubset(g, c, 2),
  (g, c) => findHiddenSubset(g, c, 2),
  (g, c) => findNakedSubset(g, c, 3),
  (g, c) => findHiddenSubset(g, c, 3),
  findXWing,
  findXyWing,
]

/**
 * 現在の盤面から次の論理ステップを1つ探す。
 * candidatesを渡した場合はそれを手がかりの計算に使う（過去の除外の蓄積を引き継げる）。
 * 省略した場合はgridから素の候補を計算する。
 * 実装済みのどの技巧も当てはまらなければnull（手詰まり＝バックトラック相当が必要）。
 */
export const findNextStep = (grid: Grid, candidates?: CandidateMap): HintStep | null => {
  const c = candidates ?? computeCandidates(grid)
  for (const technique of TECHNIQUES) {
    const step = technique(grid, c)
    if (step) return step
  }
  return null
}

/**
 * ステップの結果を候補マップに反映する（元の配列は変更せず新しい配列を返す）。
 * fillの場合はそのマスの候補を0にし、周辺（行・列・箱）の候補からもその数字を除外する。
 * eliminationのみの場合は該当マスの候補から該当数字を除外する。
 */
export const applyStepToCandidates = (candidates: CandidateMap, step: HintStep): CandidateMap => {
  const next = candidates.slice()
  if (step.fill) {
    const { index, digit } = step.fill
    next[index] = 0
    for (const peer of PEERS[index]) {
      next[peer] &= ~digitBit(digit)
    }
  } else {
    for (const { index, digit } of step.eliminations) {
      next[index] &= ~digitBit(digit)
    }
  }
  return next
}
