#!/usr/bin/env node
/**
 * MCP Server with GUI Bridge
 * Runs as a console app, spawns Electron GUI when needed and communicates via WebSocket.
 */

// Prevent stdout pollution - redirect all logs to stderr
console.log = (...args: unknown[]) => console.error('[LOG]', ...args)
console.warn = (...args: unknown[]) => console.error('[WARN]', ...args)
console.info = (...args: unknown[]) => console.error('[INFO]', ...args)

// Debug log helper (controlled by environment variable)
const DEBUG = process.env.MCP_DEBUG === 'true'
const debugLog = (...args: unknown[]) => {
  if (DEBUG) {
    console.error('[DEBUG]', ...args)
  }
}

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { spawn, ChildProcess } from 'node:child_process'
import { WebSocketServer, WebSocket } from 'ws'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

// Use __filename, __dirname in CJS build
// In ESM, convert import.meta.url to fileURLToPath
function getScriptDir(): string {
  // esbuild CJS build: __dirname is defined
  if (typeof __dirname !== 'undefined') {
    return __dirname
  }
  // ESM environment (development mode)
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    return path.dirname(fileURLToPath(import.meta.url))
  }
  // Fallback
  return process.cwd()
}

const scriptDir = getScriptDir()

// WebSocket server (communicates with GUI)
const wss = new WebSocketServer({ port: 0 }) // Random port
let wsClient: WebSocket | null = null
let guiProcess: ChildProcess | null = null

wss.on('connection', (ws) => {
  debugLog('✅ GUI connected via WebSocket')
  wsClient = ws

  ws.on('close', () => {
    debugLog('❌ GUI disconnected')
    wsClient = null
  })

  ws.on('error', (error) => {
    debugLog('WebSocket error:', error)
  })
})

wss.on('listening', () => {
  const address = wss.address()
  if (address && typeof address !== 'string') {
    debugLog(`🔌 WebSocket server listening on port ${address.port}`)
  }
})

// Start GUI process
function startGUI() {
  if (guiProcess) {
    debugLog('GUI already running')
    return
  }

  const address = wss.address()
  if (!address || typeof address === 'string') {
    debugLog('WebSocket server address not available')
    return
  }
  const wsPort = address.port

  // mcp-bridge.cjs location:
  // - In npm package: dist/mcp-bridge.cjs
  // - Downloaded binaries: binaries/ folder (sibling to dist/)
  const getGuiPath = () => {
    // Check if running from npm package
    const npmBinariesDir = path.join(scriptDir, '..', 'binaries')
    
    switch (process.platform) {
      case 'win32': {
        // Windows: binaries/PromptBoard.exe or same dir as bridge
        const winNpmPath = path.join(npmBinariesDir, 'PromptBoard.exe')
        const winLocalPath = path.join(scriptDir, 'Promptboard.exe')
        return existsSync(winNpmPath) ? winNpmPath : winLocalPath
      }
        
      case 'darwin': {
        // macOS: binaries/PromptBoard.app or same dir as bridge
        const macNpmPath = path.join(npmBinariesDir, 'PromptBoard.app', 'Contents', 'MacOS', 'PromptBoard')
        const macLocalPath = path.join(scriptDir, 'Promptboard.app', 'Contents', 'MacOS', 'Promptboard')
        return existsSync(macNpmPath) ? macNpmPath : macLocalPath
      }
        
      case 'linux': {
        // Linux: binaries/PromptBoard or same dir as bridge
        const linuxNpmPath = path.join(npmBinariesDir, 'PromptBoard')
        const linuxLocalPath = path.join(scriptDir, 'Promptboard')
        return existsSync(linuxNpmPath) ? linuxNpmPath : linuxLocalPath
      }
        
      default:
        throw new Error(`Unsupported platform for GUI launch: ${process.platform}`)
    }
  }
  const guiPath = getGuiPath()

  debugLog(`🚀 Starting GUI: ${guiPath}`)

  guiProcess = spawn(guiPath, [`--ws-port=${wsPort}`], {
    detached: true,
    stdio: 'ignore',
  })

  guiProcess.on('error', (error) => {
    debugLog('Failed to start GUI:', error)
    guiProcess = null
  })

  guiProcess.on('close', (code) => {
    debugLog(`GUI closed with code ${code}`)
    guiProcess = null
    wsClient = null
  })
}


interface GuiMessage {
  action: string;
  id?: number;
}

interface GuiResponse {
  image?: string;
}

// Send message to GUI
function sendToGUI(message: GuiMessage): Promise<GuiResponse> {
  return new Promise((resolve, reject) => {
    if (!wsClient) {
      reject(new Error('GUI not connected'))
      return
    }

    const messageId = Date.now()
    const request = { ...message, id: messageId }

    const timeout = setTimeout(() => {
      reject(new Error('GUI response timeout'))
    }, 5000)

    const handler = (data: Buffer) => {
      try {
        const response = JSON.parse(data.toString())
        if (response.id === messageId) {
          clearTimeout(timeout)
          wsClient?.off('message', handler)
          resolve(response)
        }
      } catch (e) {
        // ignore
      }
    }

    wsClient.on('message', handler)
    wsClient.send(JSON.stringify(request))
  })
}

// Create MCP server
const server = new Server(
  {
    name: 'promptboard',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// Tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'open_whiteboard',
        description: 'Opens or focuses the Promptboard whiteboard window',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_whiteboard',
        description: 'Returns the current whiteboard content as a PNG image',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  }
})

// Tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params

  try {
    if (name === 'open_whiteboard') {
      // Start GUI if not running
      if (!guiProcess) {
        startGUI()
        // Wait for GUI connection (max 5 seconds)
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('GUI connection timeout'))
          }, 5000)

          const interval = setInterval(() => {
            if (wsClient) {
              clearTimeout(timeout)
              clearInterval(interval)
              resolve()
            }
          }, 100)
        })
      }

      // Request GUI to show window
      await sendToGUI({ action: 'show' })

      return {
        content: [
          {
            type: 'text',
            text: 'Whiteboard window opened',
          },
        ],
      }
    }

    if (name === 'get_whiteboard') {
      if (!wsClient) {
        return {
          content: [
            {
              type: 'text',
              text: 'Whiteboard is not open. Please open it first.',
            },
          ],
          isError: true,
        }
      }

      // Get image from GUI
      const response: { image?: string } = await sendToGUI({ action: 'getImage' })

      if (!response.image) {
        return {
          content: [
            {
              type: 'text',
              text: 'Failed to get whiteboard image',
            },
          ],
          isError: true,
        }
      }

      return {
        content: [
          {
            type: 'image',
            data: response.image,
            mimeType: 'image/png',
          },
        ],
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `Unknown tool: ${name}`,
        },
      ],
      isError: true,
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }
  }
})

// Start server with stdio transport layer
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  debugLog('✅ MCP Server started (console mode)')
  debugLog('   Ready to communicate with GUI via WebSocket')
}

main().catch((error) => {
  console.error('❌ Server error:', error)
  process.exit(1)
})

// Cleanup on exit
process.on('SIGINT', () => {
  debugLog('\n👋 Shutting down...')
  if (guiProcess) {
    guiProcess.kill()
  }
  wss.close()
  process.exit(0)
})
