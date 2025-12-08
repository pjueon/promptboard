import { test, expect, _electron as electron, Page, ElectronApplication } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { clearAutoSaveData, waitForAppReady } from './helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * E2E Test: Drawing Tools Functionality
 * 
 * Tests all drawing tools and their interactions:
 * - Pen, Line, Arrow, Rectangle, Ellipse, Text tools
 * - Eraser tool
 * - Color and stroke width changes
 * - Tool switching
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

async function getLastObjectType(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    const canvas = (window as { fabricCanvas?: { getObjects: () => { type: string }[] } }).fabricCanvas;
    if (!canvas) return null;
    const objects = canvas.getObjects();
    if (objects.length === 0) return null;
    return objects[objects.length - 1].type;
  });
}

async function getLastObjectColor(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    const canvas = (window as { fabricCanvas?: { getObjects: () => { stroke?: string; fill?: string }[] } }).fabricCanvas;
    if (!canvas) return null;
    const objects = canvas.getObjects();
    if (objects.length === 0) return null;
    const lastObj = objects[objects.length - 1];
    return lastObj.stroke || lastObj.fill || null;
  });
}

async function drawWithTool(page: Page, toolId: string): Promise<void> {
  // Select tool
  await page.click(`[data-testid="tool-btn-${toolId}"]`);
  await page.waitForTimeout(300);
  
  // Get canvas bounds
  const canvas = await page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');
  
  const startX = box.x + box.width * 0.3;
  const startY = box.y + box.height * 0.3;
  const endX = box.x + box.width * 0.6;
  const endY = box.y + box.height * 0.6;
  
  // Draw based on tool type
  if (toolId === 'pen') {
    // Free drawing
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 50, startY + 50);
    await page.mouse.move(endX, endY);
    await page.mouse.up();
  } else if (toolId === 'text') {
    // Click to add text
    await page.mouse.click(startX, startY);
    await page.waitForTimeout(200);
    await page.keyboard.type('Test Text');
    await page.keyboard.press('Escape');
  } else {
    // Shape tools (line, arrow, rectangle, ellipse)
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY);
    await page.mouse.up();
  }
  
  // Wait for object to be created and auto-switch to select tool
  await page.waitForTimeout(500);
}

test.describe('Drawing Tools Functionality', () => {
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

  test('should draw with pen tool', async () => {
    const initialCount = await getCanvasObjectCount(page);
    expect(initialCount).toBe(0); // Verify clean state
    
    await drawWithTool(page, 'pen');
    
    // Pen tool flattens to background, so check if canvas has content
    const hasContent = await page.evaluate(() => {
      const canvas = (window as { fabricCanvas?: { backgroundImage: unknown; getObjects: () => unknown[] } }).fabricCanvas;
      if (!canvas) return false;
      // Check if there's a background image or objects
      return canvas.backgroundImage !== null || canvas.getObjects().length > 0;
    });
    expect(hasContent).toBe(true);
  });

  test('should draw a line', async () => {
    const initialCount = await getCanvasObjectCount(page);
    expect(initialCount).toBe(0);
    
    await drawWithTool(page, 'line');
    
    const finalCount = await getCanvasObjectCount(page);
    expect(finalCount).toBe(1);
    
    const objectType = await getLastObjectType(page);
    expect(objectType).toBe('editableLine');
  });

  test('should draw an arrow', async () => {
    const initialCount = await getCanvasObjectCount(page);
    expect(initialCount).toBe(0);
    
    await drawWithTool(page, 'arrow');
    
    const finalCount = await getCanvasObjectCount(page);
    expect(finalCount).toBeGreaterThan(0);
    
    // Arrow creates both line and triangle
    const objectType = await getLastObjectType(page);
    expect(objectType).toMatch(/group|line|triangle/);
  });

  test('should draw a rectangle', async () => {
    const initialCount = await getCanvasObjectCount(page);
    expect(initialCount).toBe(0);
    
    await drawWithTool(page, 'rectangle');
    
    const finalCount = await getCanvasObjectCount(page);
    expect(finalCount).toBe(1);
    
    const objectType = await getLastObjectType(page);
    expect(objectType).toBe('rect');
  });

  test('should draw an ellipse', async () => {
    const initialCount = await getCanvasObjectCount(page);
    expect(initialCount).toBe(0);
    
    await drawWithTool(page, 'ellipse');
    
    const finalCount = await getCanvasObjectCount(page);
    expect(finalCount).toBe(1);
    
    const objectType = await getLastObjectType(page);
    expect(objectType).toBe('ellipse');
  });

  test('should add text with text tool', async () => {
    const initialCount = await getCanvasObjectCount(page);
    expect(initialCount).toBe(0);
    
    await drawWithTool(page, 'text');
    
    const finalCount = await getCanvasObjectCount(page);
    expect(finalCount).toBe(1);
    
    const objectType = await getLastObjectType(page);
    expect(objectType).toMatch(/text|i-text/i);
  });

  test('should switch between tools correctly', async () => {
    // Draw with rectangle (not pen, since pen flattens to background)
    await drawWithTool(page, 'rectangle');
    let count = await getCanvasObjectCount(page);
    expect(count).toBe(1);
    
    // Switch to line
    await drawWithTool(page, 'line');
    count = await getCanvasObjectCount(page);
    expect(count).toBe(2);
    
    // Switch to ellipse
    await drawWithTool(page, 'ellipse');
    count = await getCanvasObjectCount(page);
    expect(count).toBe(3);
  });

  test('should apply color changes to new drawings', async () => {
    // Change color to red
    await page.click('[data-testid="color-picker"]');
    await page.fill('[data-testid="color-picker"]', '#ff0000');
    await page.waitForTimeout(100);
    
    // Draw a rectangle
    await drawWithTool(page, 'rectangle');
    
    // Check if the object has red color
    const color = await getLastObjectColor(page);
    expect(color).toBeTruthy();
    expect(color?.toLowerCase()).toContain('ff0000');
  });

  test('should apply stroke width changes to new drawings', async () => {
    // Set stroke width to maximum (20px)
    await page.fill('[data-testid="stroke-slider"]', '20');
    await page.waitForTimeout(100);
    
    // Draw a line
    await drawWithTool(page, 'line');
    
    // Verify stroke width
    const strokeWidth = await page.evaluate(() => {
      const canvas = (window as { fabricCanvas?: { getObjects: () => { strokeWidth?: number }[] } }).fabricCanvas;
      if (!canvas) return 0;
      const objects = canvas.getObjects();
      if (objects.length === 0) return 0;
      return objects[objects.length - 1].strokeWidth;
    });
    
    expect(strokeWidth).toBe(20);
  });

  test('should erase objects with eraser tool', async () => {
    // Draw multiple objects
    await drawWithTool(page, 'rectangle');
    await drawWithTool(page, 'line');
    await drawWithTool(page, 'ellipse');
    
    let count = await getCanvasObjectCount(page);
    expect(count).toBe(3);
    
    // Switch to eraser
    await page.click('[data-testid="tool-btn-eraser"]');
    await page.waitForTimeout(100);
    
    // Get canvas and click on an object to erase it
    const canvas = await page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    // Click in the middle where objects are likely to be
    await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.45);
    await page.waitForTimeout(300);
    
    // Object count should decrease
    count = await getCanvasObjectCount(page);
    expect(count).toBeLessThan(3);
  });

  test('should show font size slider only for text tool', async () => {
    // Initially font slider should not be visible
    const fontSliderBefore = await page.locator('[data-testid="font-slider"]').isVisible();
    expect(fontSliderBefore).toBe(false);
    
    // Select text tool
    await page.click('[data-testid="tool-btn-text"]');
    await page.waitForTimeout(100);
    
    // Font slider should now be visible
    const fontSliderAfter = await page.locator('[data-testid="font-slider"]').isVisible();
    expect(fontSliderAfter).toBe(true);
    
    // Switch to another tool
    await page.click('[data-testid="tool-btn-pen"]');
    await page.waitForTimeout(100);
    
    // Font slider should be hidden again
    const fontSliderFinal = await page.locator('[data-testid="font-slider"]').isVisible();
    expect(fontSliderFinal).toBe(false);
  });

  test('should highlight active tool button', async () => {
    // Check pen tool (default)
    const penBtn = page.locator('[data-testid="tool-btn-pen"]');
    let penActive = await penBtn.evaluate((el) => el.classList.contains('active'));
    expect(penActive).toBe(true);
    
    // Switch to rectangle
    await page.click('[data-testid="tool-btn-rectangle"]');
    await page.waitForTimeout(100);
    
    // Pen should no longer be active
    penActive = await penBtn.evaluate((el) => el.classList.contains('active'));
    expect(penActive).toBe(false);
    
    // Rectangle should be active
    const rectBtn = page.locator('[data-testid="tool-btn-rectangle"]');
    const rectActive = await rectBtn.evaluate((el) => el.classList.contains('active'));
    expect(rectActive).toBe(true);
  });
});
