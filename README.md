# 🎨 PromptBoard

> **The Shared Whiteboard for AI Agents via MCP.**

Paste screenshots, highlight specific details, and share visual context directly via MCP.
Stop saving images to files. Just copy, paste, mark, and ask.


**Demo**: 

https://github.com/user-attachments/assets/3a07ca9d-d989-4d6c-aef1-4eebbd6d0cca


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
claude mcp add promptboard "npx -y promptboard"
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

For detailed installation instructions, including manual setup and building from source, please refer to the **[MCP Setup Guide](./doc/mcp-setup.md)**.

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
- **[MCP Architecture](./doc/mcp-architecture.md)** - Internal architecture details
