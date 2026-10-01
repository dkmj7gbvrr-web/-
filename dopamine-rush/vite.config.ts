import { defineConfig, type Plugin } from 'vite'

/** ビルドごとに変わる ID。公開中のページがこれと違う版を見つけたら読み込み直す */
const BUILD_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/** dist/version.json に BUILD_ID を書き出す */
function versionFile(): Plugin {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/-/dopamine-rush/',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [versionFile()],
})
