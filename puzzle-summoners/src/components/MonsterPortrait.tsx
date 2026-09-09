import { ELEMENT_META } from '../game/orbTheme'
import type { AttackElement, Rarity } from '../game/types'

interface MonsterPortraitProps {
  readonly element: AttackElement
  readonly rarity: Rarity
  readonly className?: string
}

/** 属性ごとの装飾（炎の粒子・水滴・葉・光の粒・闇の靄）。4★以上のシルエット周りに添えて属性らしさを強める */
const ElementAccents = ({ element, gradientId }: { element: AttackElement; gradientId: string }) => {
  switch (element) {
    case 'fire':
      return (
        <g fill={`url(#${gradientId})`} opacity={0.85}>
          <path d="M14,78 C10,70 14,62 20,60 C17,68 19,74 24,76 C22,70 25,64 30,62 C27,70 30,76 26,82 C22,86 16,84 14,78 Z" />
          <path d="M78,30 C75,24 78,18 83,17 C81,23 82,27 86,29 C84,24 86,20 90,19 C88,25 90,29 87,33 C84,36 80,35 78,30 Z" />
        </g>
      )
    case 'water':
      return (
        <g fill={`url(#${gradientId})`} opacity={0.85}>
          <path d="M20,22 C20,28 15,32 15,38 C15,43 18,46 22,46 C26,46 29,43 29,38 C29,32 24,28 24,22 C23,20 21,20 20,22 Z" />
          <path d="M84,68 C84,73 80,76 80,81 C80,85 82,88 86,88 C89,88 92,85 92,81 C92,76 87,73 87,68 C86,66 85,66 84,68 Z" />
        </g>
      )
    case 'wood':
      return (
        <g fill={`url(#${gradientId})`} opacity={0.85}>
          <path d="M16,60 C8,58 4,50 8,42 C14,46 18,46 22,42 C20,50 24,56 16,60 Z" />
          <path d="M88,34 C96,32 100,24 96,16 C90,20 86,20 82,16 C84,24 80,30 88,34 Z" />
        </g>
      )
    case 'light':
      return (
        <g fill={`url(#${gradientId})`}>
          <path d="M18,20 L20,26 L26,28 L20,30 L18,36 L16,30 L10,28 L16,26 Z" />
          <path d="M86,66 L87.5,70.5 L92,72 L87.5,73.5 L86,78 L84.5,73.5 L80,72 L84.5,70.5 Z" />
        </g>
      )
    case 'dark':
      return (
        <g fill={`url(#${gradientId})`} opacity={0.7}>
          <path d="M10,66 C6,64 6,58 10,56 C14,60 18,60 21,57 C21,63 18,68 10,66 Z" />
          <path d="M92,26 C96,24 96,18 92,16 C88,20 84,20 81,17 C81,23 84,28 92,26 Z" />
        </g>
      )
  }
}

/** 属性・レアリティごとに姿がはっきり変わる、簡略化したモンスターシルエットSVG */
export const MonsterPortrait = ({ element, rarity, className }: MonsterPortraitProps) => {
  const meta = ELEMENT_META[element]
  const gradId = `mp-grad-${element}`
  const darkId = `mp-dark-${element}`

  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={`${meta.label}属性のモンスター`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={meta.glow} />
          <stop offset="100%" stopColor={meta.color} />
        </linearGradient>
        <linearGradient id={darkId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={meta.color} />
          <stop offset="100%" stopColor="#1a1730" />
        </linearGradient>
      </defs>

      {rarity >= 4 && <ElementAccents element={element} gradientId={gradId} />}

      {rarity === 1 && (
        <g stroke="#00000033" strokeWidth={1.5}>
          <path
            d="M50,18 C28,18 14,42 14,64 C14,84 29,95 50,95 C71,95 86,84 86,64 C86,42 72,18 50,18 Z"
            fill={`url(#${gradId})`}
          />
          <ellipse cx="32" cy="42" rx="7" ry="9" fill="#ffffffaa" stroke="none" />
          <circle cx="38" cy="66" r="4.5" fill="#241f3d" stroke="none" />
          <circle cx="62" cy="66" r="4.5" fill="#241f3d" stroke="none" />
        </g>
      )}

      {rarity === 2 && (
        <g stroke="#00000033" strokeWidth={1.5}>
          <path d="M50,30 C20,30 25,10 32,26 Z" fill={`url(#${gradId})`} />
          <path d="M50,30 C80,30 75,10 68,26 Z" fill={`url(#${gradId})`} />
          <path d="M50,28 C31,28 20,48 20,66 C20,85 33,95 50,95 C67,95 80,85 80,66 C80,48 69,28 50,28 Z" fill={`url(#${gradId})`} />
          <path d="M78,80 C88,82 90,90 84,94 C82,88 78,86 74,88 Z" fill={`url(#${gradId})`} stroke="none" />
          <circle cx="40" cy="64" r="4" fill="#241f3d" stroke="none" />
          <circle cx="60" cy="64" r="4" fill="#241f3d" stroke="none" />
          <path d="M44,76 Q50,80 56,76" fill="none" stroke="#241f3d" strokeWidth={2} strokeLinecap="round" />
        </g>
      )}

      {rarity === 3 && (
        <g stroke="#00000033" strokeWidth={1.5}>
          <path d="M30,52 L70,52 L76,94 L24,94 Z" fill={`url(#${darkId})`} />
          <circle cx="27" cy="56" r="9" fill={`url(#${gradId})`} />
          <circle cx="73" cy="56" r="9" fill={`url(#${gradId})`} />
          <circle cx="50" cy="30" r="17" fill={`url(#${gradId})`} />
          <circle cx="44" cy="30" r="2.6" fill="#241f3d" stroke="none" />
          <circle cx="56" cy="30" r="2.6" fill="#241f3d" stroke="none" />
        </g>
      )}

      {rarity === 4 && (
        <g stroke="#00000033" strokeWidth={1.5}>
          <path d="M50,40 L18,92 L50,82 L82,92 Z" fill={`url(#${darkId})`} opacity={0.9} />
          <path d="M28,50 L72,50 L80,94 L20,94 Z" fill={`url(#${gradId})`} />
          <circle cx="24" cy="53" r="10.5" fill={`url(#${darkId})`} />
          <circle cx="76" cy="53" r="10.5" fill={`url(#${darkId})`} />
          <circle cx="50" cy="27" r="18" fill={`url(#${gradId})`} />
          <path d="M38,12 L50,2 L62,12 L50,20 Z" fill={`url(#${gradId})`} />
          <circle cx="43" cy="27" r="2.8" fill="#241f3d" stroke="none" />
          <circle cx="57" cy="27" r="2.8" fill="#241f3d" stroke="none" />
        </g>
      )}

      {rarity === 5 && (
        <g stroke="#00000022" strokeWidth={1.2}>
          <path
            d="M30,46 C6,40 -2,58 4,76 C14,68 24,60 33,52 Z"
            fill={`url(#${gradId})`}
            transform="scale(-1,1) translate(-100,0)"
          />
          <path d="M30,46 C6,40 -2,58 4,76 C14,68 24,60 33,52 Z" fill={`url(#${gradId})`} />
          <ellipse cx="50" cy="14" rx="15" ry="5.5" fill="none" stroke={meta.glow} strokeWidth={3} />
          <path d="M33,52 L67,52 L74,95 L26,95 Z" fill={`url(#${darkId})`} />
          <circle cx="50" cy="30" r="16" fill={`url(#${gradId})`} />
          <circle cx="45" cy="30" r="2.6" fill="#241f3d" stroke="none" />
          <circle cx="55" cy="30" r="2.6" fill="#241f3d" stroke="none" />
        </g>
      )}

      {rarity === 6 && (
        <g stroke="#00000022" strokeWidth={1.2}>
          {/* 翼（肩から扇状に広がる膜翼。先に描いて胴体の背後に回り込ませる） */}
          <path
            d="M30,48 C8,30 -12,20 -28,20 L-6,36 L-34,52 L-4,50 L-26,76 L22,74 C24,64 26,56 30,48 Z"
            fill={`url(#${darkId})`}
            transform="scale(-1,1) translate(-100,0)"
          />
          <path
            d="M30,48 C8,30 -12,20 -28,20 L-6,36 L-34,52 L-4,50 L-26,76 L22,74 C24,64 26,56 30,48 Z"
            fill={`url(#${darkId})`}
          />
          <path
            d="M30,48 L-28,20 M30,48 L-34,52 M30,48 L-26,76"
            fill="none"
            stroke={meta.glow}
            strokeWidth={1}
            opacity={0.55}
            transform="scale(-1,1) translate(-100,0)"
          />
          <path
            d="M30,48 L-28,20 M30,48 L-34,52 M30,48 L-26,76"
            fill="none"
            stroke={meta.glow}
            strokeWidth={1}
            opacity={0.55}
          />

          {/* しっぽ */}
          <path d="M58,84 C72,90 84,86 82,74 C77,81 68,84 60,79 Z" fill={`url(#${gradId})`} />

          {/* 脚 */}
          <path d="M40,80 C35,86 34,92 37,97 L47,97 C49,91 47,85 43,80 Z" fill={`url(#${darkId})`} />
          <path d="M60,80 C65,86 66,92 63,97 L53,97 C51,91 53,85 57,80 Z" fill={`url(#${darkId})`} />
          <path
            d="M37,97 L34,102 L39,98 M43,97 L43,103 L46,99 M53,97 L54,103 L57,99 M63,97 L66,102 L61,98"
            fill="none"
            stroke="#1a1730"
            strokeWidth={1.4}
            strokeLinecap="round"
          />

          {/* 胴体（くびれのある竜の体躯） */}
          <path
            d="M50,50 C36,50 27,60 29,70 C30,76 33,79 37,81 C33,86 34,90 39,94 L44,88 L56,88 L61,94 C66,90 67,86 63,81 C67,79 70,76 71,70 C73,60 64,50 50,50 Z"
            fill={`url(#${gradId})`}
          />

          {/* 角（後ろへ大きく反る） */}
          <path d="M40,14 C33,4 29,-9 36,-16 C45,-7 47,6 44,16 Z" fill={`url(#${gradId})`} />
          <path d="M60,14 C67,4 71,-9 64,-16 C55,-7 53,6 56,16 Z" fill={`url(#${gradId})`} />
          {/* 冠飾り */}
          <path d="M44,9 L46,2 L50,7 L54,2 L56,9 Z" fill={`url(#${gradId})`} />

          {/* 頭部（細めた竜の顔） */}
          <path
            d="M50,10 C40,10 32,16 30,26 C28,35 33,42 40,44 L50,56 L60,44 C67,42 72,35 70,26 C68,16 60,10 50,10 Z"
            fill={`url(#${gradId})`}
          />
          <ellipse cx="41" cy="27" rx="2.6" ry="4.2" transform="rotate(-18 41 27)" fill="#1a1730" stroke="none" />
          <ellipse cx="59" cy="27" rx="2.6" ry="4.2" transform="rotate(18 59 27)" fill="#1a1730" stroke="none" />
          <path d="M44,43 L46,52 L50,45 Z" fill="#f4f1ff" stroke="none" />
          <path d="M56,43 L54,52 L50,45 Z" fill="#f4f1ff" stroke="none" />
        </g>
      )}
    </svg>
  )
}
