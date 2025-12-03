import { BrowserWindow } from 'electron'
import { WebSocket } from 'ws'

/**
 * WebSocket Bridge for MCP Communication
 * Handles WebSocket communication between MCP server (console app) and Electron GUI.
 */
export class WebSocketBridge {
  private ws: WebSocket | null = null
  private mainWindow: BrowserWindow | null = null

  constructor(private port: number) {}

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://localhost:${this.port}`)

      this.ws.on('open', () => {
        console.error('✅ Connected to MCP bridge server')
        resolve()
      })

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error)
        reject(error)
      })

      this.ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString())
          const response = await this.handleMessage(message)
          this.ws?.send(JSON.stringify(response))
        } catch (error) {
          console.error('Error handling message:', error)
        }
      })

      this.ws.on('close', () => {
        console.error('❌ Disconnected from MCP bridge server')
        this.ws = null
      })
    })
  }

  private async handleMessage(message: any): Promise<any> {
    const { id, action } = message

    if (action === 'show') {
      // Show window
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) {
          this.mainWindow.restore()
        }
        this.mainWindow.show()
        this.mainWindow.focus()
      }
      return { id, success: true }
    }

    if (action === 'getImage') {
      // Get canvas image
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        return { id, error: 'Window not available' }
      }

      try {
        const base64Image = await this.mainWindow.webContents.executeJavaScript(`
          (async function() {
            await new Promise(resolve => {
              if (document.readyState === 'complete') {
                resolve();
              } else {
                window.addEventListener('load', resolve);
              }
            });

            const canvas = document.querySelector('#whiteboard-canvas');
            if (!canvas) return null;

            const fabricCanvas = canvas.fabric;
            if (!fabricCanvas) return null;

            const dataUrl = fabricCanvas.toDataURL({ format: 'png', quality: 1 });
            return dataUrl.replace(/^data:image\\/png;base64,/, '');
          })()
        `)

        return { id, image: base64Image }
      } catch (error) {
        return { id, error: error instanceof Error ? error.message : String(error) }
      }
    }

    return { id, error: 'Unknown action' }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}
