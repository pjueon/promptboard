import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { WebSocketBridge } from './ws-bridge.js'
import { loadSettings, saveSettings, type AppSettings } from './settings.js'
import { loadWhiteboardState, saveWhiteboardState, deleteWhiteboardState, type FabricCanvasData } from './whiteboard-state.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Promptboard Electron Main Process
 *
 * Execution modes:
 * 1. Standalone: Promptboard.exe (standard whiteboard app)
 * 2. MCP Mode: Promptboard.exe --ws-port=12345 (communicates with MCP Bridge)
 */

// Detect WebSocket port (MCP mode)
const wsPortArg = process.argv.find(arg => arg.startsWith('--ws-port='))
const wsPort = wsPortArg ? parseInt(wsPortArg.split('=')[1]) : null
const isMCPMode = wsPort !== null

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock()

let mainWindow: BrowserWindow | null = null
let wsBridge: WebSocketBridge | null = null

function createWindow() {
  const windowConfig: Electron.BrowserWindowConstructorOptions = {
    width: 1200,
    height: 800,
    frame: false,
    transparent: false,
    hasShadow: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, '../preload/index.mjs'),
    },
    title: 'Promptboard',
    show: false,
    backgroundColor: '#ffffff',
  }
  
  
  mainWindow = new BrowserWindow(windowConfig)

  // Log window information after creation
  mainWindow.webContents.on('did-finish-load', () => {
    console.error('Window loaded successfully')
    console.error('Window bounds:', mainWindow?.getBounds())
  })

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show()
    }
  })

  // Load content
  const isDev = !app.isPackaged

  if (isDev) {
    const devServerPort = process.env.VITE_DEV_SERVER_PORT || '5555'
    mainWindow.loadURL(`http://localhost:${devServerPort}`)

    // Open DevTools only in Standalone mode
    if (!isMCPMode && mainWindow.webContents) {
      mainWindow.webContents.openDevTools()
    }
  } else {
    // Production: load from built files
    // vite-plugin-electron builds renderer in dist/ folder
    const rendererPath = path.join(process.resourcesPath, 'app.asar', 'dist', 'index.html')
    mainWindow.loadFile(rendererPath)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    if (wsBridge) {
      wsBridge.disconnect()
      wsBridge = null
    }
  })
}

function setupIPCHandlers() {
  // Window controls
  ipcMain.handle('window:minimize', () => {
    if (mainWindow) {
      mainWindow.minimize()
    }
  })

  ipcMain.handle('window:maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize()
      } else {
        mainWindow.maximize()
      }
      return mainWindow.isMaximized()
    }
    return false
  })

  ipcMain.handle('window:close', () => {
    if (mainWindow) {
      mainWindow.close()
    }
  })

  ipcMain.handle('window:is-maximized', () => {
    return mainWindow?.isMaximized() || false
  })

  // Load settings
  ipcMain.handle('settings:load', () => {
    return loadSettings()
  })

  // Save settings
  ipcMain.handle('settings:save', (_event, settings: AppSettings) => {
    return saveSettings(settings)
  })

  // Whiteboard state management
  ipcMain.handle('whiteboard:load-state', () => {
    return loadWhiteboardState()
  })

  ipcMain.handle('whiteboard:save-state', (_event, canvasData: FabricCanvasData) => {
    return saveWhiteboardState(canvasData)
  })

  ipcMain.handle('whiteboard:delete-state', () => {
    return deleteWhiteboardState()
  })
}

if (!gotTheLock) {
  // Another instance is already running → quit
  app.quit()
} else {
  // Detect second instance attempt
  app.on('second-instance', () => {
    // Focus existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    // Setup IPC handlers
    setupIPCHandlers()
    
    createWindow()

    // MCP mode: Connect to Bridge server via WebSocket
    if (isMCPMode && wsPort) {
      try {
        wsBridge = new WebSocketBridge(wsPort)
        wsBridge.setMainWindow(mainWindow!)
        await wsBridge.connect()
        console.error('✅ Connected to MCP Bridge Server')
      } catch (error) {
        console.error('❌ Failed to connect to MCP Bridge:', error)
        process.exit(1)
      }
    }
  })

  app.on('window-all-closed', () => {
    // Quit app on non-macOS platforms
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', () => {
    // macOS: clicking dock icon
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
}
