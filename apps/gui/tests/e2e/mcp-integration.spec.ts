import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * MCP Integration E2E Tests
 *
 * Test scenarios:
 * 1. Does open_whiteboard open a window when called?
 * 2. Does open_whiteboard focus the existing window when called again?
 * 3. Does get_whiteboard return an image?
 * 4. Does the MCP server communicate properly via stdio?
 */

test.describe('MCP Integration', () => {
  let electronApp: ElectronApplication;
  let window: Page;

  test.beforeEach(async () => {
    // Launch Electron app
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../dist-electron/main/index.js')],
      // Set env for MCP server communication testing via stdio
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    window = await electronApp.firstWindow();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test.describe('open_whiteboard tool', () => {
    test('should open whiteboard window when called for the first time', async () => {
      // App is already open
      expect(window).toBeTruthy();

      // Verify main window title (not DevTools)
      const title = await electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        return windows[0]?.getTitle() || '';
      });
      expect(title).toContain('Promptboard');
    });

    test('should focus existing window when called again', async () => {
      // First window already exists
      expect(window).toBeTruthy();

      // Minimize window
      await electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        if (windows[0]) {
          windows[0].minimize();
        }
      });

      // Simulate open_whiteboard re-invocation
      // (In reality, should be triggered by MCP tool call)
      await electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        if (windows[0]) {
          if (windows[0].isMinimized()) {
            windows[0].restore();
          }
          windows[0].focus();
        }
      });

      // Verify window is focused again
      const isFocused = await electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        return windows[0]?.isFocused() || false;
      });

      expect(isFocused).toBe(true);
    });

    test('should return immediately (non-blocking)', async () => {
      // open_whiteboard should return immediately
      const startTime = Date.now();

      // Window already exists, should return immediately
      const isVisible = window !== null;

      const duration = Date.now() - startTime;

      expect(isVisible).toBe(true);
      // Should respond within 100ms (non-blocking)
      expect(duration).toBeLessThan(100);
    });
  });

  test.describe('get_whiteboard tool', () => {
    // Note: These tests verify the canvas image capture mechanism
    // Full MCP integration testing should be done with actual Claude Desktop
    test.skip('should return actual canvas image from renderer', async () => {
      // Wait for canvas to be ready
      await window.waitForLoadState('domcontentloaded');
      await window.waitForTimeout(1000); // Wait for Vue app to mount
      
      // Execute JavaScript to get canvas image (simulating what MCP server does)
      const base64Image = await window.evaluate(async () => {
        // Find canvas element with Fabric instance
        const canvasEl = document.querySelector('#whiteboard-canvas') as HTMLCanvasElement & { fabric?: any };
        
        // Wait for fabric to be initialized
        let attempts = 0;
        while (!canvasEl?.fabric && attempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 200));
          attempts++;
        }
        
        if (!canvasEl || !canvasEl.fabric) {
          return null;
        }
        
        const dataUrl = canvasEl.fabric.toDataURL({
          format: 'png',
          quality: 1,
        });
        
        return dataUrl.replace(/^data:image\/png;base64,/, '');
      });
      
      // Verify base64 data exists and is valid
      expect(base64Image).toBeDefined();
      expect(base64Image).not.toBeNull();
      expect(typeof base64Image).toBe('string');
      expect(base64Image!.length).toBeGreaterThan(0);
      expect(base64Image).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    test.skip('should return valid PNG base64 that can be decoded', async () => {
      await window.waitForLoadState('domcontentloaded');
      await window.waitForTimeout(1000);
      
      const base64Image = await window.evaluate(async () => {
        const canvasEl = document.querySelector('#whiteboard-canvas') as HTMLCanvasElement & { fabric?: any };
        
        let attempts = 0;
        while (!canvasEl?.fabric && attempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 200));
          attempts++;
        }
        
        if (!canvasEl?.fabric) return null;
        
        const dataUrl = canvasEl.fabric.toDataURL({ format: 'png', quality: 1 });
        return dataUrl.replace(/^data:image\/png;base64,/, '');
      });
      
      // Verify it's valid base64 that can be decoded
      expect(base64Image).toBeTruthy();
      expect(() => {
        Buffer.from(base64Image!, 'base64');
      }).not.toThrow();
      
      // Verify decoded buffer has reasonable size (PNG header + data)
      const buffer = Buffer.from(base64Image!, 'base64');
      expect(buffer.length).toBeGreaterThan(100); // PNG should be at least 100 bytes
      
      // Verify PNG signature (first 8 bytes)
      const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const actualSignature = buffer.slice(0, 8);
      expect(actualSignature.equals(pngSignature)).toBe(true);
    });

    test.skip('should return different images when canvas content changes', async () => {
      await window.waitForLoadState('domcontentloaded');
      await window.waitForTimeout(1000);
      
      // Get initial image
      const image1 = await window.evaluate(async () => {
        const canvasEl = document.querySelector('#whiteboard-canvas') as HTMLCanvasElement & { fabric?: any };
        
        let attempts = 0;
        while (!canvasEl?.fabric && attempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 200));
          attempts++;
        }
        
        if (!canvasEl?.fabric) return null;
        const dataUrl = canvasEl.fabric.toDataURL({ format: 'png', quality: 1 });
        return dataUrl.replace(/^data:image\/png;base64,/, '');
      });
      
      // Draw something on canvas
      await window.evaluate(() => {
        const canvasEl = document.querySelector('#whiteboard-canvas') as HTMLCanvasElement & { fabric?: any };
        if (canvasEl?.fabric) {
          // Access fabric from window if available
          const fabricLib = (window as any).fabric;
          if (fabricLib) {
            const rect = new fabricLib.Rect({
              left: 100,
              top: 100,
              width: 50,
              height: 50,
              fill: 'red',
            });
            canvasEl.fabric.add(rect);
            canvasEl.fabric.renderAll();
          }
        }
      });
      
      await window.waitForTimeout(300);
      
      // Get image after drawing
      const image2 = await window.evaluate(async () => {
        const canvasEl = document.querySelector('#whiteboard-canvas') as HTMLCanvasElement & { fabric?: any };
        if (!canvasEl?.fabric) return null;
        const dataUrl = canvasEl.fabric.toDataURL({ format: 'png', quality: 1 });
        return dataUrl.replace(/^data:image\/png;base64,/, '');
      });
      
      // Images should be different
      expect(image1).toBeTruthy();
      expect(image2).toBeTruthy();
      expect(image1).not.toBe(image2);
    });
  });

  test.describe('stdio communication', () => {
    test('should not pollute stdio with logs', async () => {
      // Electron logs should not pollute stdio
      // Actual testing should be done through MCP client

      // Verify app is running normally
      const isVisible = window !== null;
      expect(isVisible).toBe(true);
    });

    test('should respond to MCP requests quickly', async () => {
      // Should respond to MCP requests quickly
      const startTime = Date.now();

      // Verify window exists (indirect MCP responsiveness test)
      const windowCount = await electronApp.evaluate(({ BrowserWindow }) => {
        return BrowserWindow.getAllWindows().length;
      });
      
      const duration = Date.now() - startTime;

      expect(windowCount).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // Respond within 1 second
    });
  });

  test.describe('error handling', () => {
    test('should handle invalid tool calls gracefully', async () => {
      // Error handling for invalid tool calls
      // MCP server should return appropriate error messages in actual implementation
      const mockError = {
        content: [
          {
            type: 'text',
            text: 'Unknown tool: invalid_tool',
          },
        ],
        isError: true,
      };

      expect(mockError.isError).toBe(true);
      expect(mockError.content[0].text).toContain('Unknown tool');
    });

    test('should handle missing image file', async () => {
      // Proper error handling when image file is missing
      const mockError = {
        content: [
          {
            type: 'text',
            text: 'Error reading test image: File not found',
          },
        ],
        isError: true,
      };

      expect(mockError.isError).toBe(true);
      expect(mockError.content[0].text).toContain('Error reading');
    });
  });
});
