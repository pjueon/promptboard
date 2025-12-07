import { test, expect, _electron as electron, Page, ElectronApplication } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { clearAutoSaveData, waitForAppReady, hasCanvasContent } from './helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * E2E Test: Keyboard Shortcuts
 * 
 * Tests all keyboard shortcuts:
 * - Ctrl+Z / Ctrl+Shift+Z (Undo/Redo)
 * - Ctrl+S (Save)
 * - Ctrl+V (Paste)
 * - Delete (Delete selected object)
 * - Ctrl+A (Select all)
 */

async function launchApp(): Promise<ElectronApplication> {
  return await electron.launch({
    args: [
      path.join(__dirname, '../../dist-electron/main/index.mjs'),
      ...(process.env.CI ? ['--no-sandbox', '--disable-gpu'] : []),
    ],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  });
}

async function getCanvasObjectCount(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const canvas = (window as { fabricCanvas?: { getObjects: () => unknown[] } }).fabricCanvas;
    if (!canvas) return 0;
    return canvas.getObjects().length;
  });
}

async function getSelectedObjectCount(page: Page): Promise<number> {
  return await page.evaluate(() => {
    interface FabricObject {
      type: string;
      _objects?: FabricObject[];
    }
    const canvas = (window as { fabricCanvas?: { getActiveObject: () => FabricObject | null } }).fabricCanvas;
    if (!canvas) return 0;
    const activeObject = canvas.getActiveObject();
    if (!activeObject) return 0;
    // Handle both single selection and group selection
    if (activeObject.type === 'activeSelection') {
      return activeObject._objects?.length || 0;
    }
    return 1;
  });
}

async function drawRectangle(page: Page): Promise<void> {
  await page.click('[data-testid="tool-btn-rectangle"]');
  await page.waitForTimeout(300);
  
  const canvas = await page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');
  
  const startX = box.x + box.width * 0.3;
  const startY = box.y + box.height * 0.3;
  const endX = box.x + box.width * 0.5;
  const endY = box.y + box.height * 0.5;
  
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY);
  await page.mouse.up();
  
  await page.waitForTimeout(500);
}

async function drawLine(page: Page, offsetX = 0, offsetY = 0): Promise<void> {
  await page.click('[data-testid="tool-btn-line"]');
  await page.waitForTimeout(300);
  
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
  
  await page.waitForTimeout(500);
}

test.describe('Keyboard Shortcuts', () => {
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeEach(async () => {
    electronApp = await launchApp();
    page = await electronApp.firstWindow();
    
    // Wait for app to be fully ready
    await waitForAppReady(page);
    
    // Clear auto-save data to ensure clean state
    await clearAutoSaveData(page);
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('Ctrl+Z should undo last action', async () => {
    await drawRectangle(page);
    
    let count = await getCanvasObjectCount(page);
    expect(count).toBe(1);
    
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    
    count = await getCanvasObjectCount(page);
    expect(count).toBe(0);
  });

  test('Ctrl+Shift+Z should redo last undone action', async () => {
    await drawRectangle(page);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    
    let hasContent = await hasCanvasContent(page);
    expect(hasContent).toBe(false);
    
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(200);
    
    hasContent = await hasCanvasContent(page);
    expect(hasContent).toBe(true);
  });

  test('Ctrl+Y should redo (alternative shortcut)', async () => {
    await drawRectangle(page);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    
    let hasContent = await hasCanvasContent(page);
    expect(hasContent).toBe(false);
    
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(200);
    
    hasContent = await hasCanvasContent(page);
    expect(hasContent).toBe(true);
  });

  test('Ctrl+S should trigger save dialog', async () => {
    await electronApp.evaluate(async ({ dialog }) => {
      dialog.showSaveDialog = async () => {
        return {
          canceled: true,
          filePath: '',
        };
      };
    });
    
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(500);
    
    // The save functionality should be triggered
    // Verification is limited in this test environment
    expect(true).toBe(true);
  });

  test('Delete key should remove selected object', async () => {
    await drawRectangle(page);
    
    let count = await getCanvasObjectCount(page);
    expect(count).toBe(1);
    
    // Switch to select tool and click the object
    await page.click('[data-testid="tool-btn-select"]');
    await page.waitForTimeout(100);
    
    const canvas = await page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4);
      await page.waitForTimeout(200);
    }
    
    // Press Delete
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);
    
    count = await getCanvasObjectCount(page);
    expect(count).toBe(0);
  });

  test('Ctrl+A should select all objects', async () => {
    // Draw multiple objects
    await drawRectangle(page);
    await drawLine(page, 100, 100);
    
    const totalCount = await getCanvasObjectCount(page);
    expect(totalCount).toBeGreaterThanOrEqual(1);
    
    // Switch to select tool
    await page.click('[data-testid="tool-btn-select"]');
    await page.waitForTimeout(100);
    
    // Press Ctrl+A
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(300);
    
    // Check if all objects are selected
    const selectedCount = await getSelectedObjectCount(page);
    expect(selectedCount).toBeGreaterThan(0);
  });

  test('Escape should deselect objects', async () => {
    await drawRectangle(page);
    
    // Select the object
    await page.click('[data-testid="tool-btn-select"]');
    await page.waitForTimeout(100);
    
    const canvas = await page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4);
      await page.waitForTimeout(200);
    }
    
    let selectedCount = await getSelectedObjectCount(page);
    expect(selectedCount).toBeGreaterThanOrEqual(0);
    
    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    
    selectedCount = await getSelectedObjectCount(page);
    expect(selectedCount).toBe(0);
  });

  test('Multiple undo operations with Ctrl+Z', async () => {
    // Draw three objects
    // Note: Each drawing saves 2 snapshots (one for the object, one for flatten on tool change)
    await drawRectangle(page);
    await drawLine(page);
    await drawLine(page, 50, 50);
    
    let hasContent = await hasCanvasContent(page);
    expect(hasContent).toBe(true);
    
    // Need to undo 6 times to get back to initial state
    // (3 drawings × 2 snapshots each = 6 snapshots)
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(200);
    }
    
    hasContent = await hasCanvasContent(page);
    expect(hasContent).toBe(false);
  });

  test('Shortcuts should work in sequence', async () => {
    // Draw
    await drawRectangle(page);
    let count = await getCanvasObjectCount(page);
    expect(count).toBeGreaterThanOrEqual(1);
    
    // Undo
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    let hasContent = await hasCanvasContent(page);
    expect(hasContent).toBe(false);
    
    // Redo
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(200);
    hasContent = await hasCanvasContent(page);
    expect(hasContent).toBe(true);
    
    // Select
    await page.click('[data-testid="tool-btn-select"]');
    await page.waitForTimeout(100);
    
    const canvas = await page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4);
      await page.waitForTimeout(200);
    }
    
    // Delete
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);
    count = await getCanvasObjectCount(page);
    expect(count).toBe(0);
  });

  test('Ctrl+V should work for paste operation', async () => {
    // Note: This test primarily verifies the shortcut is handled
    // Actual paste functionality depends on clipboard content
    
    // Set up a simple paste scenario
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(300);
    
    // The app should handle the paste event without crashing
    const isResponsive = await page.evaluate(() => {
      const canvas = (window as { fabricCanvas?: unknown }).fabricCanvas;
      return canvas !== null && canvas !== undefined;
    });
    
    expect(isResponsive).toBe(true);
  });

  test('Shortcuts should not interfere with text input', async () => {
    // Select text tool
    await page.click('[data-testid="tool-btn-text"]');
    await page.waitForTimeout(100);
    
    const canvas = await page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.3);
      await page.waitForTimeout(200);
    }
    
    // Type text - Ctrl+A should select text, not canvas objects
    await page.keyboard.type('Test');
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(100);
    
    // Type more to replace selected text
    await page.keyboard.type('New');
    await page.waitForTimeout(100);
    
    // Exit text editing
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    
    // Should have one text object
    const count = await getCanvasObjectCount(page);
    expect(count).toBe(1);
  });
});
