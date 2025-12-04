import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketServer } from 'ws';

// Mock electron module
vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}));

import { WebSocketBridge } from '../../electron/main/ws-bridge';
import type { BrowserWindow } from 'electron';

/**
 * WebSocket Bridge Unit Test
 * 
 * Test Objectives:
 * 1. Can it connect to the WebSocket server?
 * 2. Does it show the window when it receives a 'show' action?
 * 3. Does it return the canvas image when it receives a 'getImage' action?
 * 4. Is it cleaned up on disconnection?
 */

describe('WebSocketBridge', () => {
  let wss: WebSocketServer;
  let wsPort: number;

  beforeEach(async () => {
    // Create a WebSocket server for testing
    await new Promise<void>((resolve) => {
      wss = new WebSocketServer({ port: 0 }, () => {
        const address = wss.address() as { port: number };
        wsPort = address.port;
        resolve();
      });
    });
  });

  afterEach(() => {
    wss.close();
  });

  describe('Connection', () => {
    it('should connect to WebSocket server', async () => {
      const bridge = new WebSocketBridge(wsPort);

      const connectPromise = new Promise<void>((resolve) => {
        wss.on('connection', () => {
          resolve();
        });
      });

      await bridge.connect();
      await connectPromise;

      bridge.disconnect();
    });

    it('should reject if connection fails', async () => {
      const bridge = new WebSocketBridge(99999); // Invalid port

      await expect(bridge.connect()).rejects.toThrow();
    });
  });

  describe('Message Handling', () => {
    it('should respond to "show" action', async () => {
      const bridge = new WebSocketBridge(wsPort);
      
      // Mock BrowserWindow
      const mockWindow = {
        isMinimized: vi.fn(() => false),
        restore: vi.fn(),
        show: vi.fn(),
        focus: vi.fn(),
        isDestroyed: vi.fn(() => false),
      } as unknown as BrowserWindow;

      bridge.setMainWindow(mockWindow);

      const responsePromise = new Promise<{ id: number; success: boolean }>((resolve) => {
        wss.on('connection', (ws) => {
          ws.on('message', (data) => {
            const response = JSON.parse(data.toString());
            resolve(response);
          });

          // Send show action
          ws.send(JSON.stringify({ id: 1, action: 'show' }));
        });
      });

      await bridge.connect();
      const response = await responsePromise;

      expect(response.id).toBe(1);
      expect(response.success).toBe(true);
      expect(mockWindow.show).toHaveBeenCalled();
      expect(mockWindow.focus).toHaveBeenCalled();

      bridge.disconnect();
    });

    it('should restore minimized window on "show" action', async () => {
      const bridge = new WebSocketBridge(wsPort);
      
      const mockWindow = {
        isMinimized: vi.fn(() => true),
        restore: vi.fn(),
        show: vi.fn(),
        focus: vi.fn(),
        isDestroyed: vi.fn(() => false),
      } as unknown as BrowserWindow;

      bridge.setMainWindow(mockWindow);

      const responsePromise = new Promise<void>((resolve) => {
        wss.on('connection', (ws) => {
          ws.on('message', () => {
            resolve();
          });
          ws.send(JSON.stringify({ id: 1, action: 'show' }));
        });
      });

      await bridge.connect();
      await responsePromise;

      expect(mockWindow.restore).toHaveBeenCalled();

      bridge.disconnect();
    });

    it('should respond to "getImage" action with canvas data', async () => {
      const bridge = new WebSocketBridge(wsPort);
      
      const mockBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      
      const mockWindow = {
        isDestroyed: vi.fn(() => false),
        webContents: {
          executeJavaScript: vi.fn(async () => mockBase64),
        },
      } as unknown as BrowserWindow;

      bridge.setMainWindow(mockWindow);

      const responsePromise = new Promise<{ id: number; image: string }>((resolve) => {
        wss.on('connection', (ws) => {
          ws.on('message', (data) => {
            const response = JSON.parse(data.toString());
            resolve(response);
          });
          ws.send(JSON.stringify({ id: 2, action: 'getImage' }));
        });
      });

      await bridge.connect();
      const response = await responsePromise;

      expect(response.id).toBe(2);
      expect(response.image).toBe(mockBase64);
      expect(mockWindow.webContents.executeJavaScript).toHaveBeenCalled();

      bridge.disconnect();
    });

    it('should return error if window not available for getImage', async () => {
      const bridge = new WebSocketBridge(wsPort);
      
      const mockWindow = {
        isDestroyed: vi.fn(() => true),
      } as unknown as BrowserWindow;

      bridge.setMainWindow(mockWindow);

      const responsePromise = new Promise<{ id: number; error: string }>((resolve) => {
        wss.on('connection', (ws) => {
          ws.on('message', (data) => {
            const response = JSON.parse(data.toString());
            resolve(response);
          });
          ws.send(JSON.stringify({ id: 3, action: 'getImage' }));
        });
      });

      await bridge.connect();
      const response = await responsePromise;

      expect(response.id).toBe(3);
      expect(response.error).toBeDefined();

      bridge.disconnect();
    });

    it('should return error for unknown action', async () => {
      const bridge = new WebSocketBridge(wsPort);

      const responsePromise = new Promise<{ id: number; error: string }>((resolve) => {
        wss.on('connection', (ws) => {
          ws.on('message', (data) => {
            const response = JSON.parse(data.toString());
            resolve(response);
          });
          ws.send(JSON.stringify({ id: 4, action: 'unknown' }));
        });
      });

      await bridge.connect();
      const response = await responsePromise;

      expect(response.id).toBe(4);
      expect(response.error).toBe('Unknown action');

      bridge.disconnect();
    });
  });

  describe('Disconnection', () => {
    it('should clean up on disconnect', async () => {
      const bridge = new WebSocketBridge(wsPort);

      await bridge.connect();
      bridge.disconnect();

      // Should be able to reconnect
      await bridge.connect();
      bridge.disconnect();
    });
  });
});
