# 🎨 PromptBoard

> **Visual Context Buffer for AI Agents**

**PromptBoard provides a whiteboard to share visual context with AI Agents.**

Stop describing UI bugs, architecture diagrams, or data flows in text. Just **snap**, **sketch**, and **send** it to your AI agent via MCP (Model Context Protocol).

---

## 🚀 Quick Start

### Standard Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "promptboard": {
      "command": "npx",
      "args": ["-y", "promptboard"]
    }
  }
}
```

<details>
<summary><b>Claude Desktop</b></summary>

**Config Location:**
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

**Configuration:**
```json
{
  "mcpServers": {
    "promptboard": {
      "command": "npx",
      "args": ["-y", "promptboard"]
    }
  }
}
```

Restart Claude Desktop and test:
- "Open the whiteboard"
- "What's on the whiteboard?"

</details>

<details>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add promptboard npx -y promptboard
```

Or manually edit `~/.claude/config.json`:
```json
{
  "mcpServers": {
    "promptboard": {
      "command": "npx",
      "args": ["-y", "promptboard"]
    }
  }
}
```

**Custom Commands (Optional):**
```bash
npx promptboard init claude-code
```

This creates `.claude/commands/`:
- `/whiteboard` - Opens the visual whiteboard
- `/check-board [message]` - Analyzes whiteboard content

**Example:**
```
/check-board What does the red section mean?
```

</details>

<details>
<summary><b>Gemini CLI</b></summary>

**Config Location:** `.gemini/settings.json` in your project

**Configuration:**
```json
{
  "mcpServers": {
    "promptboard": {
      "command": "npx",
      "args": ["-y", "promptboard"]
    }
  }
}
```

**Custom Commands (Optional):**
```bash
npx promptboard init gemini-cli
```

This creates `.gemini/commands/`:
- `/whiteboard` - Opens the visual whiteboard
- `/check-board [message]` - Analyzes whiteboard content

</details>

---

## 📦 Alternative Installation Methods

### Method 1: Download from GitHub Releases

1. **Download the latest release:**
   - Visit [Releases](https://github.com/pjueon/promptboard/releases/latest)
   - Download the appropriate file for your OS:
     - Windows: `PromptBoard-x.x.x-win.zip`
     - macOS: `PromptBoard-x.x.x-mac.zip` (Intel/Apple Silicon Universal)
     - Linux: `PromptBoard-x.x.x-linux.zip`

2. **Extract the archive:**
   ```bash
   # Windows (PowerShell)
   Expand-Archive PromptBoard-0.1.0-win.zip -DestinationPath C:\PromptBoard
   
   # macOS/Linux
   unzip PromptBoard-0.1.0-mac.zip -d ~/PromptBoard
   ```

3. **Configure MCP:**
   ```json
   {
     "mcpServers": {
       "promptboard": {
         "command": "node",
         "args": ["C:\\PromptBoard\\mcp-bridge.cjs"]
       }
     }
   }
   ```
   
   On macOS/Linux, update the path accordingly (e.g., `/Users/username/PromptBoard/mcp-bridge.cjs`)

### Method 2: Build from Source

1. **Clone and build:**
   ```bash
   git clone https://github.com/pjueon/promptboard.git
   cd promptboard
   npm install
   cd apps/gui
   npm run build
   ```

2. **Configure MCP:**
   ```json
   {
     "mcpServers": {
       "promptboard": {
         "command": "node",
         "args": ["/absolute/path/to/promptboard/apps/gui/dist/mcp-bridge.cjs"]
       }
     }
   }
   ```

3. **Alternative: Use npm script:**
   ```json
   {
     "mcpServers": {
       "promptboard": {
         "command": "npm",
         "args": ["run", "mcp"],
         "cwd": "/absolute/path/to/promptboard/apps/gui"
       }
     }
   }
   ```

---

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
