import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const BUILD_ID = String(Date.now())

// Ghi dist/version.json mỗi lần build để app tự phát hiện bản mới
function versionFilePlugin() {
  return {
    name: 'hk-version-file',
    closeBundle() {
      try {
        fs.mkdirSync('dist', { recursive: true })
        fs.writeFileSync(path.join('dist', 'version.json'), JSON.stringify({ build: BUILD_ID }))
      } catch {}
    },
  }
}

export default defineConfig({
  plugins: [react(), versionFilePlugin()],
  define: { __APP_BUILD__: JSON.stringify(BUILD_ID) },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: 'all'
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: 'all'
  },
  build: {
    outDir: 'dist'
  }
})
