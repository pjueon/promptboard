# MCP Setup Guide

## Quick Start

### 1. Build the Application

```bash
# From project root
npm install
npm run build
```

**Output:** `apps/gui/dist/` and `apps/gui/dist-electron/`
- `dist/mcp-bridge.cjs` - MCP Bridge Server
- `dist-electron/` - Electron build files

**For packaged app (optional):**
```bash
cd apps/gui
npx electron-builder
# Output: The packaged application will be in `apps/gui/release/`.
# The exact path depends on your OS:
# - Windows: `win-unpacked/Promptboard.exe`
# - macOS: `mac/Promptboard.app` or `mac-arm64/Promptboard.app`
# - Linux: `linux-unpacked/promptboard`
```

### 2. Configure Your AI Client

#### Claude Desktop

**Config File:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "promptboard": {
      "command": "node",
      "args": ["C:\\path\\to\\PromptBoard\\apps\\gui\\dist\\mcp-bridge.cjs"]
    }
  }
}
```

**Steps:**
1. Open `%APPDATA%\Claude\claude_desktop_config.json`
2. Add `promptboard` server config
3. Update path to your actual location
4. Restart Claude Desktop
5. Test: Ask Claude to "open whiteboard"

#### Gemini CLI

**Config File:** `.gemini/settings.json` (in project root)

```json
{
  "mcpServers": {
    "promptboard": {
      "command": "node",
      "args": ["apps/gui/dist/mcp-bridge.cjs"]
    }
  }
}
```

**Steps:**
1. Navigate to project root: `cd C:\path\to\PromptBoard`
2. Config is already in `.gemini/settings.json`
3. Restart Gemini CLI
4. Test: `gemini ask "@promptboard open whiteboard"`

### 3. Available Commands

Once configured, you can ask your AI:

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

## How It Works

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
