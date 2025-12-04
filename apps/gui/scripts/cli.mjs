#!/usr/bin/env node
import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Parse command line arguments
const args = process.argv.slice(2)
const command = args[0]

if (command === 'init') {
  await handleInit(args.slice(1))
} else {
  // Default: run MCP server from dist/mcp-bridge.cjs
  const bridgePath = join(__dirname, '../dist/mcp-bridge.cjs')
  
  if (!existsSync(bridgePath)) {
    console.error('Error: MCP bridge not found. Please run "npm run build" first.')
    process.exit(1)
  }
  
  // Execute the MCP bridge server
  const child = spawn('node', [bridgePath], {
    stdio: 'inherit',
    shell: false
  })
  
  child.on('error', (error) => {
    console.error('Failed to start MCP server:', error)
    process.exit(1)
  })
  
  child.on('exit', (code) => {
    process.exit(code || 0)
  })
}

async function handleInit(args) {
  const platform = args[0]
  
  if (!platform) {
    console.error('Error: Platform argument is required.')
    console.log('Usage: npx promptboard init <platform>')
    console.log('Available platforms: claude-code, gemini-cli')
    process.exit(1)
  }
  
  console.log(`Generating custom prompts for ${platform}...`)
  
  // Platform configurations: different file formats and paths
  const platformConfigs = {
    'claude-code': {
      format: 'md',
      outputDir: join(process.cwd(), '.claude', 'commands'),
      commands: [
        {
          filename: 'whiteboard.md',
          content: `---
description: Open Promptboard whiteboard for visual collaboration
---

Use the open_whiteboard tool to launch the Promptboard whiteboard window. This allows visual collaboration and note-taking.
`
        },
        {
          filename: 'check-board.md',
          content: `---
argument-hint: [optional message or question]
description: Get current whiteboard content and analyze it
---

Use the get_whiteboard tool to retrieve the current whiteboard content as a PNG image.

$ARGUMENTS

Analyze the image and provide insights about what's on the board. If a specific question or area of focus was mentioned above, pay special attention to that.
`
        }
      ]
    },
    'gemini-cli': {
      format: 'toml',
      outputDir: join(process.cwd(), '.gemini', 'commands'),
      commands: [
        {
          filename: 'whiteboard.toml',
          content: `description = "Open Promptboard whiteboard for visual collaboration"

prompt = """
Use the open_whiteboard tool to launch the Promptboard whiteboard window. This allows visual collaboration and note-taking.
"""
`
        },
        {
          filename: 'check-board.toml',
          content: `description = "Get current whiteboard content and analyze it"

prompt = """
Use the get_whiteboard tool to retrieve the current whiteboard content as a PNG image.

{{args}}

Analyze the image and provide insights about what's on the board. If a specific question or area of focus was mentioned above, pay special attention to that.
"""
`
        }
      ]
    }
  }
  
  const config = platformConfigs[platform]
  
  if (!config) {
    console.error(`Error: Unknown platform "${platform}"`)
    console.log('Available platforms: claude-code, gemini-cli')
    process.exit(1)
  }
  
  // Create output directory
  if (!existsSync(config.outputDir)) {
    await mkdir(config.outputDir, { recursive: true })
  }
  
  // Write all command files
  for (const cmd of config.commands) {
    const outputPath = join(config.outputDir, cmd.filename)
    await writeFile(outputPath, cmd.content, 'utf-8')
    console.log(`✓ Created: ${outputPath}`)
  }
  
  console.log(`\n✓ Custom prompts generated successfully!`)
  console.log('\nNext steps:')
  console.log('1. Configure your MCP server:')
  
  if (platform === 'claude-code') {
    console.log('   Edit your Claude Code MCP config (~/.claude/config.json or project config):')
  } else if (platform === 'gemini-cli') {
    console.log('   Edit your Gemini CLI MCP config (~/.gemini/config.json or project config):')
  }
  
  console.log('   {')
  console.log('     "mcpServers": {')
  console.log('       "promptboard": {')
  console.log('         "command": "npx",')
  console.log('         "args": ["promptboard"]')
  console.log('       }')
  console.log('     }')
  console.log('   }')
  console.log('')
  console.log('2. Available commands:')
  
  if (platform === 'claude-code') {
    console.log('   /whiteboard              - Open the visual whiteboard')
    console.log('   /check-board [message]   - Analyze whiteboard content')
    console.log('')
    console.log('   Example: /check-board What does the red section mean?')
  } else if (platform === 'gemini-cli') {
    console.log('   /whiteboard              - Open the visual whiteboard')
    console.log('   /check-board [message]   - Analyze whiteboard content')
    console.log('')
    console.log('   Example: /check-board What does the red section mean?')
  }
}
