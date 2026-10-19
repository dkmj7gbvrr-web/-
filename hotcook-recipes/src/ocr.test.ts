import { describe, expect, it } from 'vitest'
import { cleanOcrText } from './ocr'
import { parseRecipeText } from './parse'
import { extractModes } from './parse/mode'

describe('cleanOcrText', () => {
  it('和文の文字間・数字と単位の間の空白を消し、英数字の前の空白は1つに残す', () => {
    expect(cleanOcrText('鶏 む ね 肉   2 枚')).toBe('鶏むね肉 2枚')
    const line = cleanOcrText('手 動 で 作 る → 煮 物 を 作 る ( ま ぜ る ) → 30 分')
    expect(line).toBe('手動で作る → 煮物を作る ( まぜる ) → 30分')
    expect(extractModes([line])[0]).toMatchObject({ category: '煮物を作る', stir: 'まぜる', minutes: 30 })
    expect(cleanOcrText('No.  21')).toBe('No. 21')
  })

  it('空行が続いても2行までにまとめる', () => {
    expect(cleanOcrText('材料\n\n\n\n玉ねぎ')).toBe('材料\n\n玉ねぎ')
  })

  it('読み取り結果をそのままレシピとして解析できる', () => {
    const ocr = '豚 の 角 煮\n材 料 ( 2 人 分 )\n豚 バ ラ 400g\n作 り 方\n1. 手 動 で 作 る → 煮 物 を 作 る ( ま ぜ な い ) → 60 分'
    const d = parseRecipeText(cleanOcrText(ocr))
    expect(d.title).toBe('豚の角煮')
    expect(d.ingredients).toEqual(['豚バラ 400g'])
    expect(d.modes[0]).toMatchObject({ category: '煮物を作る', stir: 'まぜない', minutes: 60 })
  })
})

describe('スクリーンショット由来のテキスト', () => {
  it('先頭のステータスバー（時刻・電波表示）を料理名にしない', () => {
    expect(parseRecipeText('12:345G\nホットクックで無水カレー\n材料\n玉ねぎ 2個').title).toBe('ホットクックで無水カレー')
    expect(parseRecipeText('9:41\n5G 82%\n豚の角煮\n材料\n豚バラ').title).toBe('豚の角煮')
  })
})

describe('材料の行頭記号と数字の空白', () => {
  it('「・玉ねぎ 2 個」→「玉ねぎ 2個」', () => {
    const d = parseRecipeText(cleanOcrText('カレー\n材料\n・玉ねぎ 2 個\n* カレールウ 4 かけ\n作り方\n1. 切る。'))
    expect(d.ingredients).toEqual(['玉ねぎ 2個', 'カレールウ 4かけ'])
  })
})
