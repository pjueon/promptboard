/**
 * Build Verification Script
 * 빌드 산출물의 존재 여부 및 무결성 검증
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.join(__dirname, '..')

// 검증할 파일 목록
const requiredFiles = [
  { path: 'dist/index.html', minSize: 100, description: 'Vite build output (HTML)' },
  { path: 'dist-electron/main/index.mjs', minSize: 1000, description: 'Electron main process' },
  { path: 'dist-electron/preload/index.mjs', minSize: 100, description: 'Electron preload script' },
  { path: 'dist/mcp-bridge.cjs', minSize: 10000, description: 'MCP Bridge Server' },
]

let hasErrors = false

console.log('🔍 Verifying build artifacts...\n')

for (const file of requiredFiles) {
  const filePath = path.join(rootDir, file.path)

  process.stdout.write(`  Checking ${file.description}... `)

  if (!fs.existsSync(filePath)) {
    console.log('❌ MISSING')
    console.error(`    Expected file not found: ${file.path}`)
    hasErrors = true
    continue
  }

  const stats = fs.statSync(filePath)
  if (stats.size < file.minSize) {
    console.log(`❌ TOO SMALL (${stats.size} bytes < ${file.minSize} bytes)`)
    console.error(`    File is suspiciously small: ${file.path}`)
    hasErrors = true
    continue
  }

  console.log(`✅ OK (${stats.size} bytes)`)
}

console.log()

if (hasErrors) {
  console.error('❌ Build verification failed!')
  console.error('   Please run "npm run build" and "npm run build:mcp" first.')
  process.exit(1)
}

console.log('✅ All build artifacts verified successfully!')
