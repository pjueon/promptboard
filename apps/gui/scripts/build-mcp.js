import { build } from 'esbuild'
import path from 'path'
import { fileURLToPath } from 'url'
import { builtinModules } from 'module'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Build MCP Bridge Server
build({
  entryPoints: [path.join(__dirname, '../electron/mcp/bridge.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: path.join(__dirname, '../dist/mcp-bridge.cjs'),
  format: 'cjs',
  sourcemap: true,
  // Specify Node.js built-in modules as external
  external: [...builtinModules, ...builtinModules.map(m => `node:${m}`)],
}).then(() => {
  console.log('✅ MCP Bridge Server built successfully')
}).catch((error) => {
  console.error('❌ MCP Bridge Server build failed:', error)
  process.exit(1)
})
