#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

// Define available tools
const TOOLS: Tool[] = [
  {
    name: 'open_whiteboard',
    description: 'Opens the Promptboard whiteboard window. In Phase 0, this is a placeholder that returns immediately.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Optional prompt to display on the whiteboard (not implemented in Phase 0)',
        },
      },
    },
  },
  {
    name: 'get_whiteboard',
    description: 'Returns the current whiteboard content as a PNG image. In Phase 0, this returns a test dummy image.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
]

// list_tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  }
})

// call_tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params

  try {
    if (name === 'open_whiteboard') {
      // Phase 0: Placeholder - return immediately
      return {
        content: [
          {
            type: 'text',
            text: 'Whiteboard opened (Phase 0: UI not implemented yet)',
          },
        ],
      }
    }

    if (name === 'get_whiteboard') {
      // Read dummy image
      const imagePath = path.join(__dirname, '../../public/test-dummy.png')

      try {
        const imageBuffer = await fs.readFile(imagePath)
        const base64Image = imageBuffer.toString('base64')

        return {
          content: [
            {
              type: 'image',
              data: base64Image,
              mimeType: 'image/png',
            },
            {
              type: 'text',
              text: 'Phase 0 test image: Red rectangle with "Hello AI!" text',
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error reading test image: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        }
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

// Start server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)

  // Log to stderr to prevent stdio pollution
  console.error('Promptboard MCP server running on stdio')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
