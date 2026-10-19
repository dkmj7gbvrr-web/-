/**
 * スクリーンショット（画像）から文字を読み取る（OCR）。
 * 「ふたりの家計簿」と同じ Tesseract.js 一式（日本語データ込み）を public/vendor/tesseract/ に置き、
 * 端末の中だけで読み取る（画像はどこにも送らない）。エンジンと日本語データで数MBあるので、
 * 初めて使うときに読み込む。
 */

interface OcrWorker {
  recognize(image: Blob): Promise<{ data: { text: string } }>
}

type Progress = (info: { status: string; progress: number }) => void

let workerPromise: Promise<OcrWorker> | null = null
let currentProgress: Progress | null = null

function getWorker(): Promise<OcrWorker> {
  if (!workerPromise) {
    const base = `${import.meta.env.BASE_URL}vendor/tesseract/`
    workerPromise = import(/* @vite-ignore */ `${base}tesseract.esm.min.js`)
      .then((mod: { default: { createWorker: (...args: unknown[]) => Promise<OcrWorker> } }) =>
        mod.default.createWorker('jpn', 1, {
          workerPath: `${base}worker.min.js`,
          corePath: `${base}tesseract-core-lstm.wasm.js`,
          langPath: `${base}lang/`,
          logger: (m: { status: string; progress: number }) => currentProgress?.(m),
        }),
      )
      .catch((e: unknown) => {
        // 通信の失敗などで読み込めなかったときは、次に押したときにやり直せるようにする
        workerPromise = null
        throw e
      })
  }
  return workerPromise
}

const CJK = String.raw`　-ヿ㐀-鿿豈-﫿！-｠`

/**
 * OCR は日本語の文字と文字の間に余計な空白を入れがちなので、和文どうしの間の空白は消す。
 * 英数字の前の空白（「大さじ 1」「No. 21」など）は残す。
 */
export function cleanOcrText(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(new RegExp(`([${CJK}])[ \\t]+(?=[${CJK}])`, 'g'), '$1')
        // 「2 個」「10 分」のような数字と単位の間の空白も消す
        .replace(new RegExp(`([0-9])[ \\t]+(?=[${CJK}])`, 'g'), '$1')
        .replace(/[ \t]+/g, ' ')
        .trim(),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 画像を順に読み取り、つなげたテキストを返す（レシピが複数枚のスクショにまたがる場合も1つにまとめる） */
export async function recognizeImages(
  images: Blob[],
  onProgress: (info: { index: number; total: number; phase: 'loading' | 'reading'; ratio: number }) => void,
): Promise<string> {
  const total = images.length
  let index = 0
  currentProgress = (m) => {
    const reading = m.status === 'recognizing text'
    onProgress({ index, total, phase: reading ? 'reading' : 'loading', ratio: Number.isFinite(m.progress) ? m.progress : 0 })
  }
  try {
    onProgress({ index: 0, total, phase: 'loading', ratio: 0 })
    const worker = await getWorker()
    const texts: string[] = []
    for (index = 0; index < total; index++) {
      onProgress({ index, total, phase: 'reading', ratio: 0 })
      const { data } = await worker.recognize(images[index])
      texts.push(cleanOcrText(data.text))
    }
    return texts.join('\n\n')
  } finally {
    currentProgress = null
  }
}
