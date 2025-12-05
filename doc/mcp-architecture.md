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

