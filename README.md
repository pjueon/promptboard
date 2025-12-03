# 🎨 PromptBoard

> **Visual Context Buffer for AI Agents**

**PromptBoard provides a whiteboard to share visual context with AI Agents.**

Stop describing UI bugs, architecture diagrams, or data flows in text. Just **snap**, **sketch**, and **send** it to your AI agent via MCP (Model Context Protocol).

## Quick Start

### 1. Build

```bash
# Clone repository
git clone https://github.com/pjueon/promptboard.git
cd promptboard

# Install dependencies
npm install

# Build application
npm run build

# Package (optional - for distribution)
cd apps/gui
npx electron-builder

# Output: apps/gui/dist/ and apps/gui/dist-electron/
```

### 2. Configure AI Client

**Claude Desktop** (`%APPDATA%\Claude\claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "promptboard": {
      "command": "node",
      "args": ["C:\\path\\to\\promptboard\\apps\\gui\\dist\\mcp-bridge.cjs"]
    }
  }
}
```

**Gemini CLI** (`.gemini/settings.json` in project root):
```json
{
  "mcpServers": {
    "promptboard": {
      "command": "node",
      "args": ["./apps/gui/dist/mcp-bridge.cjs"]
    }
  }
}
```

### 3. Use

Restart your AI client and test:
- "Open the whiteboard"
- "What's on the whiteboard?"

## Features

- 🎨 **Whiteboard Canvas** - Draw, sketch, and annotate freely
- 📸 **Screenshot Support** - Paste images directly with `Ctrl+V`
- 🖊️ **Drawing Tools** - Pen, shapes, text, eraser
- ↩️ **Undo/Redo** - Full history management (`Ctrl+Z`, `Ctrl+Shift+Z`)
- 🌍 **Multi-language** - English, Korean, Japanese
- 🌓 **Dark/Light Theme** - Customizable appearance
- 🤖 **AI Integration** - MCP protocol for Claude Code, Gemini CLI
- 💾 **Auto-save** - Persistent state across sessions

## Documentation

### User Guides
- **[MCP Setup Guide](./doc/mcp-setup.md)** - Installation and configuration
- **[Deployment Guide](./doc/deployment-guide.md)** - Build and deployment instructions
