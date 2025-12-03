#!/usr/bin/env node
/**
 * MCP Bridge Test Client
 * Check if mcp-bridge.js is working correctly
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const bridgePath = path.join(__dirname, 'dist', 'mcp-bridge.cjs')

console.log('🧪 Testing MCP Bridge:', bridgePath)
console.log('─'.repeat(50))

const mcpProcess = spawn('node', [bridgePath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    MCP_DEBUG: 'true'
  }
})

let messageId = 1

// stderr output (debug logs)
mcpProcess.stderr.on('data', (data) => {
  console.log('[STDERR]', data.toString().trim())
})

// stdout output (MCP protocol messages)
mcpProcess.stdout.on('data', (data) => {
  const lines = data.toString().trim().split('\n')
  lines.forEach(line => {
    if (line) {
      try {
        const message = JSON.parse(line)
        console.log('[STDOUT] ✅ Received:', JSON.stringify(message, null, 2))
        
        // If we receive the initialize response, request tools/list
        if (message.result && message.id === 1) {
          setTimeout(() => {
            sendRequest({
              jsonrpc: '2.0',
              id: 2,
              method: 'tools/list',
              params: {}
            })
          }, 500)
        }
      } catch (e) {
        console.log('[STDOUT] Raw:', line)
      }
    }
  })
})

mcpProcess.on('error', (error) => {
  console.error('❌ Process error:', error)
  process.exit(1)
})

mcpProcess.on('close', (code) => {
  console.log(`\n📊 Process exited with code ${code}`)
  process.exit(code || 0)
})

// MCP request sending helper
function sendRequest(request) {
  const message = JSON.stringify(request) + '\n'
  console.log('[STDIN] 📤 Sending:', JSON.stringify(request, null, 2))
  mcpProcess.stdin.write(message)
}

// Initialization request (start of MCP protocol)
setTimeout(() => {
  sendRequest({
    jsonrpc: '2.0',
    id: messageId++,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: {
          listChanged: true
        },
        sampling: {}
      },
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  })
}, 1000)

// Timeout after 10 seconds
setTimeout(() => {
  console.log('\n⏱️  Timeout - killing process')
  mcpProcess.kill()
}, 10000)

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n👋 Interrupted - killing process')
  mcpProcess.kill()
  process.exit(0)
})
