# MCP Bridge Architecture

## Overview

Promptboard uses a **two-process architecture** to enable MCP integration while maintaining a clean separation between stdio communication (for AI clients) and GUI operations (Electron).

## Why Two Processes?

**Problem:** Windows GUI applications (`.exe`) don't have functional stdio streams.

**Solution:** 
- **Process 1:** Node.js console app handles stdio ↔ MCP communication
- **Process 2:** Electron GUI app handles user interface and canvas operations
- **Bridge:** WebSocket connects the two processes

## Process Lifecycle

### MCP Bridge Server (Node.js)

```
Start: When Claude/Gemini launches MCP server
  ↓
Listen on stdio for JSON-RPC messages from AI
  ↓
Create WebSocket server on random port
  ↓
Wait for commands...

On open_whiteboard:
  ↓
spawn("Promptboard.exe", ["--ws-port=12345"])
  ↓
Wait for GUI to connect via WebSocket
  ↓
Return success

On get_whiteboard:
  ↓
Send { action: "getImage" } via WebSocket
  ↓
Receive Base64 PNG from GUI
  ↓
Return image to AI

End: When AI client closes (stdin EOF)
```

### Electron GUI

```
Start: Spawned by MCP Bridge with --ws-port arg
  ↓
Check for existing instance (Single Instance Lock)
  ↓
If already running → Notify first instance → Exit
If first instance → Continue
  ↓
Connect to WebSocket (port from --ws-port)
  ↓
Show window immediately
  ↓
Listen for WebSocket messages:
  - "getImage" → Capture canvas → Send PNG
  - "focus" → Restore and focus window
  ↓
On window close → Disconnect WebSocket → Exit

OR

Start: User double-clicks Promptboard.exe (no args)
  ↓
No --ws-port → Standalone mode
  ↓
Show window
  ↓
No MCP communication
```

## Single Instance Enforcement

Uses Electron's built-in `app.requestSingleInstanceLock()`:

```typescript
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is running
  app.quit();
} else {
  // First instance
  app.on('second-instance', () => {
    // Someone tried to launch again → Focus window
    if (mainWindow) {
      mainWindow.restore();
      mainWindow.focus();
    }
  });
}
```

**Benefits:**
- MCP Bridge can call `spawn()` repeatedly
- Electron prevents duplicate windows
- Existing window gets focused automatically
- No manual process tracking needed

## WebSocket Protocol

### GUI → Bridge (Responses)

```json
{
  "id": 1234567890,
  "image": "iVBORw0KGgo...",  // Base64 PNG
  "success": true
}
```

### Bridge → GUI (Commands)

```json
{
  "id": 1234567890,
  "action": "getImage"
}
```

```json
{
  "id": 1234567891,
  "action": "focus"
}
```

## Error Handling

### GUI Not Connected
```
User: "Get whiteboard image"
→ MCP Bridge: No WebSocket client
→ Error: "Whiteboard is not open"
```

### GUI Crashed
```
WebSocket connection lost
→ MCP Bridge: wsClient = null
→ Next open_whiteboard spawns new instance
```

### Duplicate Launch Prevented
```
MCP Bridge: spawn(Promptboard.exe)
→ Electron: Already running (lock exists)
→ New process: Notify first instance → Exit
→ First instance: Focus window
→ WebSocket: Already connected (no change)
```

## Build Artifacts

```
release/win-unpacked/
├── Promptboard.exe          # Electron GUI
├── mcp-bridge.cjs          # MCP Bridge Server (same directory)
├── mcp-bridge.cjs.map      # Source map
├── resources/
│   └── app.asar            # Contains dist/main.js, dist-renderer/
└── ... (other Electron files)
```

## Deployment

**For end users:**
1. Extract `release/win-unpacked/` directory
2. Configure AI client to run: `node path/to/win-unpacked/mcp-bridge.cjs`
3. MCP Bridge will spawn `Promptboard.exe` from same directory

**Note:** `mcp-bridge.cjs` and `Promptboard.exe` are in the same directory, making paths simple and portable.
