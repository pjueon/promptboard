# MCP Setup Guide

This guide covers three ways to set up PromptBoard with MCP-enabled AI clients.

---

## 🚀 Method 1: Quick Setup (Recommended)

### Standard Configuration

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

No installation needed - `npx` will handle everything automatically.

### Platform-Specific Instructions

#### Claude Desktop

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

#### Claude Code

```bash
claude mcp add promptboard "npx -y promptboard"
```

**Custom Commands (Optional):**
```bash
npx promptboard init claude-code
```

This creates `.claude/commands/whiteboard.md` and `.claude/commands/check-board.md`:
- `/whiteboard` - Opens the visual whiteboard
- `/check-board [message]` - Analyzes whiteboard content

#### Gemini CLI

**Config Location:** `.gemini/settings.json` (in your project)

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

This creates `.gemini/commands/whiteboard.toml` and `.gemini/commands/check-board.toml`.

### Test

1. Restart your AI client
2. Try these commands:
   - "Open the whiteboard"
   - "What's on the whiteboard?"
   - `/whiteboard` (if custom commands set up)
   - `/check-board What does the diagram show?` (if custom commands set up)

---

## 📦 Method 2: Download from GitHub Releases

### 1. Download Binary

1. Visit [GitHub Releases](https://github.com/pjueon/promptboard/releases/latest)
2. Download for your platform:
   - **Windows:** `PromptBoard-x.x.x-win.zip`
   - **macOS:** `PromptBoard-x.x.x-mac.zip` (Universal: Intel + Apple Silicon)
   - **Linux:** `PromptBoard-x.x.x-linux.zip`

### 2. Extract

**Windows (PowerShell):**
```powershell
Expand-Archive PromptBoard-0.1.0-win.zip -DestinationPath C:\PromptBoard
```

**macOS/Linux:**
```bash
unzip PromptBoard-0.1.0-mac.zip -d ~/PromptBoard
# or
tar -xzf PromptBoard-0.1.0-linux.tar.gz -C ~/PromptBoard
```

### 3. Configure MCP

**Claude Desktop:**
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

**macOS/Linux:** Update path to `/Users/username/PromptBoard/mcp-bridge.cjs` or `/home/username/PromptBoard/mcp-bridge.cjs`

---

## 🔧 Method 3: Build from Source

### 1. Clone and Build

```bash
# Clone repository
git clone https://github.com/pjueon/promptboard.git
cd promptboard

# Install dependencies
npm install

# Build application
cd apps/gui
npm run build
```

**Output:**
- `apps/gui/dist/mcp-bridge.cjs` - MCP Bridge Server
- `apps/gui/dist-electron/` - Electron build files

### 2. Configure MCP

**Option A: Direct path to mcp-bridge.cjs**
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

**Option B: Use npm script**
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

### 3. Package (Optional)

For distribution:

```bash
cd apps/gui
npx electron-builder
```

**Output:** `apps/gui/release/`
- Windows: `win-unpacked/PromptBoard.exe`
- macOS: `mac/PromptBoard.app` or `mac-arm64/PromptBoard.app`
- Linux: `linux-unpacked/promptboard`

---

## 📋 Available Commands

Once configured, you can interact with PromptBoard through your AI:

**Open Whiteboard:**
```
"Open the whiteboard"
"Show me the whiteboard"
"Launch Promptboard"
```

**Get Whiteboard Image:**
```
"What's on the whiteboard?"
"Show me what I drew"
"Capture the whiteboard"
```

**With Custom Commands (if set up):**
```
/whiteboard
/check-board
/check-board What does the red section mean?
/check-board Are there any issues in the diagram?
```

---

## 🎨 Custom Commands Setup

Custom commands provide convenient shortcuts for your AI client.

### Claude Code

```bash
npx promptboard init claude-code
```

**Creates:**
- `.claude/commands/whiteboard.md`
- `.claude/commands/check-board.md`

**File format:** Markdown with frontmatter
```markdown
---
description: Open Promptboard whiteboard for visual collaboration
---

Use the open_whiteboard tool to launch the Promptboard whiteboard window.
```

**Usage in Claude Code:**
```
/whiteboard
/check-board What's wrong with this diagram?
```

### Gemini CLI

```bash
npx promptboard init gemini-cli
```

**Creates:**
- `.gemini/commands/whiteboard.toml`
- `.gemini/commands/check-board.toml`

**File format:** TOML
```toml
description = "Open Promptboard whiteboard for visual collaboration"

prompt = """
Use the open_whiteboard tool to launch the Promptboard whiteboard window.
"""
```

**Usage in Gemini CLI:**
```
/whiteboard
/check-board {{args}}
```

### Arguments Support

The `/check-board` command accepts optional arguments:

**Claude Code:** Uses `$ARGUMENTS` placeholder
```markdown
$ARGUMENTS

Analyze the image and provide insights...
```

**Gemini CLI:** Uses `{{args}}` placeholder
```toml
prompt = """
{{args}}

Analyze the image and provide insights...
"""
```

**Example:**
```
/check-board The red highlighted area seems incorrect
```

The AI will receive your message along with the whiteboard image and provide focused analysis.

---

## 🔍 How It Works

### Architecture

```
AI Client (Claude/Gemini)
  ↕ stdio (JSON-RPC)
MCP Bridge Server (Node.js)
  ↕ WebSocket
Promptboard GUI (Electron)
```

### Process Flow

1. **AI asks to open whiteboard**
   - MCP Bridge receives `open_whiteboard` tool call
   - Bridge spawns `Promptboard.exe --ws-port=PORT`
   - Electron connects to Bridge via WebSocket
   - Window appears on screen

2. **AI asks for whiteboard content**
   - MCP Bridge receives `get_whiteboard` tool call
   - Bridge sends `getImage` command via WebSocket
   - Electron captures canvas as PNG
   - Bridge returns Base64 image to AI

### Single Instance

- Only one Promptboard window can run at a time
- Multiple "open" requests focus existing window
- Managed by Electron's Single Instance Lock

## Troubleshooting

### npm Installation Issues

**"npx promptboard" fails**

**Cause:** Network issues or npm registry problems

**Solutions:**
1. Check internet connection
2. Try with verbose logging: `npx -y promptboard --verbose`
3. Clear npm cache: `npm cache clean --force`
4. Try installing globally first: `npm install -g promptboard`

**Binary download fails during postinstall**

**Cause:** GitHub Releases not accessible or no binary for your platform

**Solutions:**
1. Check if release exists: Visit https://github.com/pjueon/promptboard/releases/latest
2. Manually download and extract to `node_modules/promptboard/binaries/`
3. PromptBoard will still work as MCP server (CLI only)

**"Module not found" errors**

**Cause:** Incomplete installation

**Solutions:**
```bash
# Reinstall the package
npm uninstall -g promptboard
npm install -g promptboard

# Or use npx (no installation needed)
npx -y promptboard
```

### "Connection closed" Error

**Cause:** MCP Bridge not found or permission issue

**Solutions:**
1. Verify path in config file is absolute and correct
2. Check `mcp-bridge.cjs` exists: `Test-Path apps\gui\dist\mcp-bridge.cjs`
3. Ensure Node.js is in PATH: `node --version`
4. Rebuild if needed: `npm run build`

### "Whiteboard is not open"

**Cause:** GUI not running or WebSocket disconnected

**Solutions:**
1. Ask AI to "open whiteboard" first
2. Check for error messages in GUI window
3. Verify build completed: `npm run build`

### GUI Doesn't Appear

**Cause:** Another instance already running or crashed

**Solutions:**
```powershell
# Kill all Promptboard processes
Stop-Process -Name "Promptboard" -Force

# Try again
gemini ask "@promptboard open whiteboard"
```

### Image Not Captured

**Cause:** Canvas not initialized or empty

**Solutions:**
1. Draw something on the whiteboard first
2. Check DevTools for JavaScript errors (Ctrl+Shift+I)
3. Restart both Bridge and GUI

## Debug Mode

Enable detailed logging:

```bash
# Set debug mode
export MCP_DEBUG=true  # Linux/Mac
$env:MCP_DEBUG="true"  # Windows PowerShell

# Run MCP bridge directly
node apps/gui/dist/mcp-bridge.cjs
```

**Debug Output (stderr):**
```
[DEBUG] 🔌 WebSocket server listening on port 54321
[DEBUG] 🚀 Starting GUI process
[DEBUG] ✅ GUI connected via WebSocket
[DEBUG] ✅ MCP Server started (stdio mode)
```

**Note:** Debug logs go to stderr, not stdout (won't interfere with MCP communication)

## Advanced Configuration

### Custom Port Range

Edit `src/mcp-server/bridge.ts`:

```typescript
// Random port (0) → Specific port
const wss = new WebSocketServer({ port: 12345 });
```

### Disable Single Instance Lock

Edit `src/main/main.ts`:

```typescript
// Comment out
// const gotTheLock = app.requestSingleInstanceLock();
// if (!gotTheLock) app.quit();
```

**Warning:** Multiple windows may cause confusion

## Deployment

### For Development

```bash
# Build for local use
npm run build

# MCP bridge location: apps/gui/dist/mcp-bridge.cjs
```

### For Distribution

```bash
# Package with electron-builder
cd apps/gui
npx electron-builder

# The packaged application is placed in `apps/gui/release/`.
# The output varies by OS (e.g., `.exe` installer and `win-unpacked` on Windows).
```

**Distribute:**
- The installer file (e.g., `.exe`, `.dmg`) from the `release` directory.
- Or, for a portable version, the unpacked folder (e.g., `win-unpacked`).

### Path Guidelines

**Absolute Path (recommended):**
```json
"args": ["C:\\path\\to\\PromptBoard\\apps\\gui\\dist\\mcp-bridge.cjs"]
```

**Relative Path (for project-local install):**
```json
"args": ["./apps/gui/dist/mcp-bridge.cjs"]
```

**Note:** Relative paths work if AI client runs from project root

## Security Considerations

### Local Only

- MCP Bridge listens on `localhost` only
- No external network access
- WebSocket port is random and local

### No Authentication

- Anyone with access to your machine can use MCP tools
- Suitable for personal development machines
- **Not recommended for shared servers**

### File System Access

- Electron GUI has full file system access
- Can read/write user's files
- Future: Implement screenshot permissions

## Next Steps

After successful setup:

1. ✅ Test both MCP tools (`open_whiteboard`, `get_whiteboard`)
2. ✅ Try drawing and capturing
3. ✅ Integrate into your AI workflow
4. ⏭️ Read [Architecture Documentation](./mcp-architecture.md)
