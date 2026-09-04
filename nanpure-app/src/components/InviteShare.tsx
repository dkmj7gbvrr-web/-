import { useState } from 'react'
import type { Difficulty } from '../sudoku/types'

interface Props {
  difficulty: Difficulty
  seed: number
}

const buildShareUrl = (difficulty: Difficulty, seed: number): string => {
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('level', String(difficulty))
  url.searchParams.set('seed', seed.toString(36))
  return url.toString()
}

export const InviteShare = ({ difficulty, seed }: Props) => {
  const [copied, setCopied] = useState(false)

  const handleClick = async () => {
    const url = buildShareUrl(difficulty, seed)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      window.prompt('このURLをコピーして共有してください', url)
    }
  }

  return (
    <button type="button" className="invite-share" onClick={handleClick}>
      {copied ? 'リンクをコピーしました！' : '🔗 同じ問題で対戦（招待リンクをコピー）'}
    </button>
  )
}
