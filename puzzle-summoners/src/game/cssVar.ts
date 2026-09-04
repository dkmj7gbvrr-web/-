import type { CSSProperties } from 'react'

/** CSSカスタムプロパティ（--foo）をReactのstyleオブジェクトとして安全に渡すためのヘルパー */
export const withCssVar = (name: string, value: string): CSSProperties => ({ [name]: value }) as CSSProperties
