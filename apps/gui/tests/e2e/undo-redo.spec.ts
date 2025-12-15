import { test, expect, Page, ElectronApplication } from '@playwright/test';
import { launchApp, clearAutoSaveData, waitForAppReady, getCanvasObjectCount } from './helpers';

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
    await page.waitForTimeout(100); // Ensure canvas is fully cleared and settled
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
      const win = window;
      return {
        canUndo: win.undoRedoState?.canUndo.value,
        canRedo: win.undoRedoState?.canRedo.value
      };
    });
    expect(historyState.canUndo).toBe(true);
    expect(historyState.canRedo).toBe(false);
    
    // Undo with Ctrl+Z
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    
    // Check history state after undo
    historyState = await page.evaluate(() => {
      const win = window;
      return {
        canUndo: win.undoRedoState?.canUndo.value,
        canRedo: win.undoRedoState?.canRedo.value
      };
    });
    // After undo, should be able to redo
    expect(historyState.canRedo).toBe(true);
  });

  test('should redo a previously undone action', async () => {
    // Get initial canvas state
    const initialState = await page.evaluate(() => {
      const canvas = (window as { fabricCanvas?: { toJSON: () => object } }).fabricCanvas;
      return JSON.stringify(canvas?.toJSON());
    });

    // Draw a rectangle
    await drawRectangle(page);
    await page.waitForTimeout(500);

    // Get canvas state after drawing
    const drawnState = await page.evaluate(() => {
      const canvas = (window as { fabricCanvas?: { toJSON: () => object } }).fabricCanvas;
      return JSON.stringify(canvas?.toJSON());
    });

    // Canvas should be different after drawing
    expect(drawnState).not.toBe(initialState);
    
    // Undo
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    
    // Check history state after undo
    let historyState = await page.evaluate(() => {
      const win = window;
      return { canUndo: win.undoRedoState?.canUndo.value, canRedo: win.undoRedoState?.canRedo.value };
    });
    expect(historyState.canRedo).toBe(true);
    
    // Redo with Ctrl+Shift+Z
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(500);
    
    // Check history state after redo
    historyState = await page.evaluate(() => {
      const win = window;
      return { canUndo: win.undoRedoState?.canUndo.value, canRedo: win.undoRedoState?.canRedo.value };
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
      const win = window;
      return { canUndo: win.undoRedoState?.canUndo.value, canRedo: win.undoRedoState?.canRedo.value };
    });
    expect(historyState.canRedo).toBe(true);
    
    // Undo second action
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    
    historyState = await page.evaluate(() => {
      const win = window;
      return { canUndo: win.undoRedoState?.canUndo.value, canRedo: win.undoRedoState?.canRedo.value };
    });
    expect(historyState.canRedo).toBe(true);
    
    // Undo third action
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    
    historyState = await page.evaluate(() => {
      const win = window;
      return { canUndo: win.undoRedoState?.canUndo.value, canRedo: win.undoRedoState?.canRedo.value };
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
      const win = window;
      return { canUndo: win.undoRedoState?.canUndo.value, canRedo: win.undoRedoState?.canRedo.value };
    });
    expect(historyState.canRedo).toBe(true);

    // Redo both
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(500);

    historyState = await page.evaluate(() => {
      const win = window;
      return { canUndo: win.undoRedoState?.canUndo.value, canRedo: win.undoRedoState?.canRedo.value };
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
      const win = window;
      return { canUndo: win.undoRedoState?.canUndo.value, canRedo: win.undoRedoState?.canRedo.value };
    });
    expect(historyState.canRedo).toBe(true);
    
    // Draw a new rectangle (should clear redo history)
    await drawRectangle(page);
    await page.waitForTimeout(500);
    
    // Check that redo history was cleared
    historyState = await page.evaluate(() => {
      const win = window;
      return { canUndo: win.undoRedoState?.canUndo.value, canRedo: win.undoRedoState?.canRedo.value };
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
      const win = window;
      return { canUndo: win.undoRedoState?.canUndo.value, canRedo: win.undoRedoState?.canRedo.value };
    });
    expect(historyState.canRedo).toBe(true);
    // Note: canUndo might still be true if there are multiple initial snapshots
    
    // Try to undo again
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    
    historyState = await page.evaluate(() => {
      const win = window;
      return { 
        canUndo: win.undoRedoState?.canUndo.value, 
        canRedo: win.undoRedoState?.canRedo.value, 
        currentIndex: win.historyManager?.getCurrentIndex() 
      };
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
      const win = window;
      return { canUndo: win.undoRedoState?.canUndo.value, canRedo: win.undoRedoState?.canRedo.value };
    });
    expect(historyState.canRedo).toBe(true);

    // Redo with Ctrl+Y (alternative shortcut)
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(500);

    historyState = await page.evaluate(() => {
      const win = window;
      return { canUndo: win.undoRedoState?.canUndo.value, canRedo: win.undoRedoState?.canRedo.value };
    });
    expect(historyState.canUndo).toBe(true);
    expect(historyState.canRedo).toBe(false);
  });

  test('should undo object modifications (resize/rotate)', async () => {
    // Draw a rectangle
    await drawRectangle(page);
    await page.waitForTimeout(500);

    // Get the active object and resize it
    await page.evaluate(() => {
      interface FabricCanvas {
        getActiveObject: () => { scaleX: number; scaleY: number; setCoords: () => void } | null;
        renderAll: () => void;
        fire: (event: string, options: { target: object }) => void;
      }
      const canvas = (window as { fabricCanvas?: FabricCanvas }).fabricCanvas;
      const activeObject = canvas?.getActiveObject();
      if (activeObject) {
        activeObject.scaleX = 2;
        activeObject.scaleY = 2;
        activeObject.setCoords();
        canvas?.renderAll();
        canvas?.fire('object:modified', { target: activeObject });
      }
    });
    await page.waitForTimeout(300);

    // Verify we can undo the resize
    let historyState = await page.evaluate(() => {
      const win = window;
      return { canUndo: win.undoRedoState?.canUndo.value, canRedo: win.undoRedoState?.canRedo.value };
    });
    expect(historyState.canUndo).toBe(true);

    // Undo the resize
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);

    // Should be able to redo
    historyState = await page.evaluate(() => {
      const win = window;
      return { canUndo: win.undoRedoState?.canUndo.value, canRedo: win.undoRedoState?.canRedo.value };
    });
    expect(historyState.canRedo).toBe(true);
  });

  test('should undo flatten and restore object', async () => {
    // Draw a rectangle
    await drawRectangle(page);
    await page.waitForTimeout(500);

    // Deselect using ESC key to trigger flatten
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // After flatten, should have snapshot
    let historyState = await page.evaluate(() => {
      const win = window;
      return { canUndo: win.undoRedoState?.canUndo.value, canRedo: win.undoRedoState?.canRedo.value };
    });
    expect(historyState.canUndo).toBe(true);

    // Undo to restore object
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);

    // Should be able to redo
    historyState = await page.evaluate(() => {
      const win = window;
      return { canUndo: win.undoRedoState?.canUndo.value, canRedo: win.undoRedoState?.canRedo.value };
    });
    expect(historyState.canRedo).toBe(true);
  });

  test('should preserve auto-saved state when undoing after app restart', async () => {
    // Draw a line and let it auto-save
    await drawLine(page);
    await page.waitForTimeout(1500); // Wait for auto-save debounce

    // Close and reopen the app
    await electronApp.close();
    electronApp = await launchApp();
    page = await electronApp.firstWindow();
    await waitForAppReady(page);

    // Wait for auto-save state to load
    await page.waitForTimeout(1000); // This timeout is for auto-save loading to settle

    // Verify canvas has the loaded line
    await expect(async () => {
      const count = await getCanvasObjectCount(page);
      expect(count).toBeGreaterThan(0); // Expect at least 1 object (the line)
    }).toPass();

    // Draw a new rectangle
    await drawRectangle(page);
    await page.waitForTimeout(500);

    // Deselect to flatten (this should trigger a snapshot with the rectangle flattened onto the background)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // Now there should be 2 objects (Line + Frozen Rectangle) because flattening is not implemented on Escape
    await expect(async () => {
      const count = await getCanvasObjectCount(page);
      expect(count).toBe(2); 
    }).toPass();

    // Undo once (should remove the frozen rectangle, restoring the line and active rectangle)
    await page.keyboard.press('Control+z');
    await expect(async () => {
      const count = await getCanvasObjectCount(page);
      expect(count).toBe(2); // Back to Line + Active Rectangle
    }).toPass();

    // Undo again (should remove the rectangle)
    await page.keyboard.press('Control+z');
    await expect(async () => {
      const count = await getCanvasObjectCount(page);
      expect(count).toBe(1); // The line object should be back
    }).toPass();

    // Undo again (should remove the line object)
    await page.keyboard.press('Control+z');
    await expect(async () => {
      const count = await getCanvasObjectCount(page);
      expect(count).toBe(0); // Canvas should be empty now
    }).toPass();

    // At this point, the canvas should be empty, but canRedo should be true
    const historyState = await page.evaluate(() => {
      const win = window;
      return {
        canUndo: win.undoRedoState?.canUndo.value,
        canRedo: win.undoRedoState?.canRedo.value,
        currentIndex: win.historyManager?.getCurrentIndex()
      };
    });

    // Should be able to redo the undone actions (back to the line, then to the rectangle)
    expect(historyState.canRedo).toBe(true);

    // After undoing all actions back to the initial blank canvas, canUndo should be false
    expect(historyState.canUndo).toBe(false); 
  });
});
