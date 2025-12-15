import { _electron as electron, Page, ElectronApplication } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Launch Electron app and wait for it to be ready
 */
export async function launchApp(): Promise<ElectronApplication> {
  const electronApp = await electron.launch({
    args: [
      path.join(__dirname, '../../dist-electron/main/index.mjs'),
      ...(process.env.CI ? ['--no-sandbox', '--disable-gpu'] : []),
    ],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  });

  return electronApp;
}

/**
 * Clear auto-saved canvas data to ensure clean test state
 * This clears both localStorage and the file system auto-save
 */
export async function clearAutoSaveData(page: Page): Promise<void> {
  // First, delete the auto-save file from disk
  await page.evaluate(async () => {
    const win = window; // Use augmented Window interface
    
    if (win.electronAPI?.whiteboard?.deleteState) {
      await win.electronAPI.whiteboard.deleteState();
    }
  });
  
  // Clear localStorage and session storage
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  
  // Clear canvas and history
  await page.evaluate(() => {
    const win = window; // Use augmented Window interface
    const canvas = win.fabricCanvas;
    const historyManager = win.historyManager;

    if (canvas?.clear) {
      canvas.clear();
      canvas.backgroundColor = '#ffffff'; // Set white background
      if (canvas.renderAll) {
        canvas.renderAll();
      }
    }
    
    // Clear history manager
    if (historyManager?.clear) {
      historyManager.clear();
    }
    
    // Save initial empty state snapshot
    if (canvas && historyManager?.saveSnapshot) {
      // HistoryManager saves the current canvas state automatically
      historyManager.saveSnapshot();
    }
  });
  
  // Wait for changes to propagate
  await page.waitForTimeout(500);
}

/**
 * Wait for app to be fully loaded and ready
 */
export async function waitForAppReady(page: Page): Promise<void> {
  // Wait for DOM to be loaded
  await page.waitForLoadState('domcontentloaded');
  
  // Wait for network to be idle (all resources loaded)
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
    // Ignore timeout - some apps don't reach network idle
  });
  
  // Wait for canvas element to be present
  await page.waitForSelector('canvas', { timeout: 10000 });
  
  // Wait for toolbar to be visible
  await page.waitForSelector('[data-testid="tool-btn-pen"]', { timeout: 10000 });
  
  // Wait for initial canvas loading (auto-save restoration) to complete
  await page.waitForFunction(() => {
    const win = window as unknown as { isCanvasLoading?: boolean | { value: boolean } };
    return win.isCanvasLoading === false || win.isCanvasLoading?.value === false;
  }, undefined, { timeout: 10000 }).catch(() => {
    // Ignore timeout - might not be exposed or needed in all cases
  });

  // Give extra time for app initialization
  await page.waitForTimeout(500);
}

/**
 * Get canvas object count
 */
export async function getCanvasObjectCount(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const canvas = (window as { fabricCanvas?: { getObjects: () => unknown[] } }).fabricCanvas;
    if (!canvas) return 0;
    return canvas.getObjects().length;
  });
}

/**
 * Check if canvas has a background image
 */
export async function hasBackgroundImage(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const canvas = (window as { fabricCanvas?: { backgroundImage?: unknown } }).fabricCanvas;
    if (!canvas) return false;
    return canvas.backgroundImage != null;
  });
}

/**
 * Check if canvas has non-empty content (either objects or non-white background)
 */
export async function hasCanvasContent(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const win = window; // Use augmented Window interface
    const canvas = win.fabricCanvas;
    const historyManager = win.historyManager;
    
    if (!canvas || !historyManager) return false;
    
    // Check if there are objects
    if (canvas.getObjects().length > 0) return true;
    
    // Check history index - if it's 0, we're at the initial empty state
    // If it's > 0, there's content (even if it's in background image)
    return historyManager.getCurrentIndex() > 0;
  });
}

/**
 * Draw a rectangle on canvas
 */
export async function drawRectangle(page: Page, offsetX = 0, offsetY = 0): Promise<void> {
  await page.click('[data-testid="tool-btn-rectangle"]');
  await page.waitForTimeout(100);
  
  const canvas = await page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');
  
  const startX = box.x + box.width * 0.3 + offsetX;
  const startY = box.y + box.height * 0.3 + offsetY;
  const endX = box.x + box.width * 0.6 + offsetX;
  const endY = box.y + box.height * 0.6 + offsetY;
  
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY);
  await page.mouse.up();
  
  await page.waitForTimeout(200);
}

/**
 * Draw a line on canvas
 */
export async function drawLine(page: Page, offsetX = 0, offsetY = 0): Promise<void> {
  await page.click('[data-testid="tool-btn-line"]');
  await page.waitForTimeout(100);
  
  const canvas = await page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');
  
  const startX = box.x + box.width * 0.2 + offsetX;
  const startY = box.y + box.height * 0.2 + offsetY;
  const endX = box.x + box.width * 0.4 + offsetX;
  const endY = box.y + box.height * 0.4 + offsetY;
  
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY);
  await page.mouse.up();
  
  await page.waitForTimeout(200);
}
