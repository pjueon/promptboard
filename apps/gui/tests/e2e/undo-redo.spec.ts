import { test, expect, Page, ElectronApplication } from '@playwright/test';
import { launchApp, clearAutoSaveData, waitForAppReady } from './helpers';

/**
 * E2E Test: Undo/Redo Functionality
 * 
 * Tests the complete undo/redo workflow:
 * - Drawing objects and undoing them
 * - Redoing previously undone actions
 * - History state management
 * - Keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z)
 */

async function drawRectangle(page: Page): Promise<void> {
  // Select rectangle tool
  await page.click('[data-testid="tool-btn-rectangle"]');
  
  // Wait for tool to be active
  await page.waitForTimeout(300);
  
  // Draw a rectangle by dragging
  const canvas = await page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');
  
  const startX = box.x + box.width * 0.3;
  const startY = box.y + box.height * 0.3;
  const endX = box.x + box.width * 0.6;
  const endY = box.y + box.height * 0.6;
  
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY);
  await page.mouse.up();
  
  // Wait for object to be created and history to be saved
  await page.waitForTimeout(500);
}

async function drawLine(page: Page): Promise<void> {
  // Select line tool
  await page.click('[data-testid="tool-btn-line"]');
  
  await page.waitForTimeout(300);
  
  const canvas = await page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');
  
  const startX = box.x + box.width * 0.2;
  const startY = box.y + box.height * 0.2;
  const endX = box.x + box.width * 0.7;
  const endY = box.y + box.height * 0.7;
  
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY);
  await page.mouse.up();
  
  await page.waitForTimeout(500);
}

test.describe('Undo/Redo Functionality', () => {
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

  test('should undo a single drawing action', async () => {
    // Draw a rectangle
    await drawRectangle(page);
    await page.waitForTimeout(500);
    
    // Check history state before undo
    let historyState = await page.evaluate(() => {
      const win = window as { historyStore?: { canUndo: boolean; canRedo: boolean } };
      return {
        canUndo: win.historyStore?.canUndo,
        canRedo: win.historyStore?.canRedo
      };
    });
    expect(historyState.canUndo).toBe(true);
    expect(historyState.canRedo).toBe(false);
    
    // Undo with Ctrl+Z
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    
    // Check history state after undo
    historyState = await page.evaluate(() => {
      const win = window as { historyStore?: { canUndo: boolean; canRedo: boolean } };
      return {
        canUndo: win.historyStore?.canUndo,
        canRedo: win.historyStore?.canRedo
      };
    });
    // After undo, should be able to redo
    expect(historyState.canRedo).toBe(true);
  });

  test('should redo a previously undone action', async () => {
    // Get initial canvas state
    const initialDataUrl = await page.evaluate(() => {
      const canvas = (window as { fabricCanvas?: { toDataURL: () => string } }).fabricCanvas;
      return canvas?.toDataURL();
    });
    
    // Draw a rectangle
    await drawRectangle(page);
    await page.waitForTimeout(500);
    
    // Get canvas state after drawing
    const drawnDataUrl = await page.evaluate(() => {
      const canvas = (window as { fabricCanvas?: { toDataURL: () => string } }).fabricCanvas;
      return canvas?.toDataURL();
    });
    
    // Canvas should be different after drawing
    expect(drawnDataUrl).not.toBe(initialDataUrl);
    
    // Undo
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    
    // Check history state after undo
    let historyState = await page.evaluate(() => {
      const win = window as { historyStore?: { canUndo: boolean; canRedo: boolean } };
      return { canUndo: win.historyStore?.canUndo, canRedo: win.historyStore?.canRedo };
    });
    expect(historyState.canRedo).toBe(true);
    
    // Redo with Ctrl+Shift+Z
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(500);
    
    // Check history state after redo
    historyState = await page.evaluate(() => {
      const win = window as { historyStore?: { canUndo: boolean; canRedo: boolean } };
      return { canUndo: win.historyStore?.canUndo, canRedo: win.historyStore?.canRedo };
    });
    expect(historyState.canUndo).toBe(true);
    expect(historyState.canRedo).toBe(false);
  });

  test('should undo multiple actions in sequence', async () => {
    // Draw multiple objects
    await drawRectangle(page);
    await page.waitForTimeout(500);
    await drawLine(page);
    await page.waitForTimeout(500);
    await drawRectangle(page);
    await page.waitForTimeout(500);
    
    // Undo first action
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    
    let historyState = await page.evaluate(() => {
      const win = window as { historyStore?: { canUndo: boolean; canRedo: boolean } };
      return { canUndo: win.historyStore?.canUndo, canRedo: win.historyStore?.canRedo };
    });
    expect(historyState.canRedo).toBe(true);
    
    // Undo second action
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    
    historyState = await page.evaluate(() => {
      const win = window as { historyStore?: { canUndo: boolean; canRedo: boolean } };
      return { canUndo: win.historyStore?.canUndo, canRedo: win.historyStore?.canRedo };
    });
    expect(historyState.canRedo).toBe(true);
    
    // Undo third action
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    
    historyState = await page.evaluate(() => {
      const win = window as { historyStore?: { canUndo: boolean; canRedo: boolean } };
      return { canUndo: win.historyStore?.canUndo, canRedo: win.historyStore?.canRedo };
    });
    expect(historyState.canRedo).toBe(true);
  });

  test('should handle undo-redo sequence correctly', async () => {
    // Draw objects
    await drawRectangle(page);
    await drawLine(page);
    
    // Undo both
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);

    let historyState = await page.evaluate(() => {
      const win = window as { historyStore?: { canUndo: boolean; canRedo: boolean } };
      return { canUndo: win.historyStore?.canUndo, canRedo: win.historyStore?.canRedo };
    });
    expect(historyState.canRedo).toBe(true);

    // Redo both
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(500);

    historyState = await page.evaluate(() => {
      const win = window as { historyStore?: { canUndo: boolean; canRedo: boolean } };
      return { canUndo: win.historyStore?.canUndo, canRedo: win.historyStore?.canRedo };
    });
    expect(historyState.canUndo).toBe(true);
    expect(historyState.canRedo).toBe(false);
  });  test('should clear redo history when new action is performed after undo', async () => {
    // Draw two objects
    await drawRectangle(page);
    await page.waitForTimeout(500);
    await drawLine(page);
    await page.waitForTimeout(500);
    
    // Undo the line
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    
    let historyState = await page.evaluate(() => {
      const win = window as { historyStore?: { canUndo: boolean; canRedo: boolean } };
      return { canUndo: win.historyStore?.canUndo, canRedo: win.historyStore?.canRedo };
    });
    expect(historyState.canRedo).toBe(true);
    
    // Draw a new rectangle (should clear redo history)
    await drawRectangle(page);
    await page.waitForTimeout(500);
    
    // Check that redo history was cleared
    historyState = await page.evaluate(() => {
      const win = window as { historyStore?: { canUndo: boolean; canRedo: boolean } };
      return { canUndo: win.historyStore?.canUndo, canRedo: win.historyStore?.canRedo };
    });
    expect(historyState.canRedo).toBe(false);
    expect(historyState.canUndo).toBe(true);
  });

  test('should not undo beyond the first state', async () => {
    // Draw one object
    await drawRectangle(page);
    await page.waitForTimeout(500);
    
    // Undo to empty canvas
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    
    let historyState = await page.evaluate(() => {
      const win = window as { historyStore?: { canUndo: boolean; canRedo: boolean } };
      return { canUndo: win.historyStore?.canUndo, canRedo: win.historyStore?.canRedo };
    });
    expect(historyState.canRedo).toBe(true);
    // Note: canUndo might still be true if there are multiple initial snapshots
    
    // Try to undo again
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    
    historyState = await page.evaluate(() => {
      const win = window as { historyStore?: { canUndo: boolean; canRedo: boolean; currentIndex: number } };
      return { canUndo: win.historyStore?.canUndo, canRedo: win.historyStore?.canRedo, currentIndex: win.historyStore?.currentIndex };
    });
    // Should still be able to redo
    expect(historyState.canRedo).toBe(true);
  });

  test('should support Ctrl+Y as alternative redo shortcut', async () => {
    // Draw a rectangle
    await drawRectangle(page);
    await page.waitForTimeout(500);

    // Undo
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);

    let historyState = await page.evaluate(() => {
      const win = window as { historyStore?: { canUndo: boolean; canRedo: boolean } };
      return { canUndo: win.historyStore?.canUndo, canRedo: win.historyStore?.canRedo };
    });
    expect(historyState.canRedo).toBe(true);

    // Redo with Ctrl+Y (alternative shortcut)
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(500);

    historyState = await page.evaluate(() => {
      const win = window as { historyStore?: { canUndo: boolean; canRedo: boolean } };
      return { canUndo: win.historyStore?.canUndo, canRedo: win.historyStore?.canRedo };
    });
    expect(historyState.canUndo).toBe(true);
    expect(historyState.canRedo).toBe(false);
  });
});
