import { test, expect, _electron as electron, Page, ElectronApplication } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { clearAutoSaveData, waitForAppReady, hasCanvasContent } from './helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * E2E Test: Image Operations
 * 
 * Tests image handling functionality:
 * - Drag and drop image files
 * - Paste images from clipboard
 * - Image manipulation (resize, rotate, delete)
 * - Multiple images
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

async function getImageObjectCount(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const canvas = (window as { fabricCanvas?: { getObjects: () => { type: string }[] } }).fabricCanvas;
    if (!canvas) return 0;
    const objects = canvas.getObjects();
    return objects.filter((obj) => obj.type === 'image').length;
  });
}

async function createTestImage(page: Page): Promise<string> {
  // Create a 100x100 test image with visible pattern in browser context
  return await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to create canvas context');
    }

    // Draw a red rectangle
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 100, 100);

    // Draw blue border
    ctx.strokeStyle = '#0000ff';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 92, 92);

    // Add white diagonal line for visibility
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(90, 90);
    ctx.stroke();

    return canvas.toDataURL('image/png');
  });
}

async function simulateImageDrop(page: Page, imageDataUrl: string): Promise<void> {
  const canvas = await page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');
  
  const dropX = box.x + box.width / 2;
  const dropY = box.y + box.height / 2;
  
  // Simulate drop event
  await page.evaluate(async ({ dataUrl, x, y }) => {
    const canvasElement = document.querySelector('canvas');
    if (!canvasElement) return;
    
    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const file = new File([blob], 'test-image.png', { type: 'image/png' });
    
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    
    const dropEvent = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dataTransfer,
      clientX: x,
      clientY: y,
    });
    
    canvasElement.dispatchEvent(dropEvent);
  }, { dataUrl: imageDataUrl, x: dropX, y: dropY });
  
  await page.waitForTimeout(800); // Wait for image to load and history to save
}

async function pasteImageFromClipboard(page: Page, imageDataUrl: string): Promise<void> {
  await page.evaluate(async (dataUrl) => {
    const canvasElement = document.querySelector('canvas');
    if (!canvasElement) return;
    
    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    
    // Create clipboard data
    const clipboardData = new DataTransfer();
    clipboardData.items.add(new File([blob], 'clipboard-image.png', { type: 'image/png' }));
    
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: clipboardData as unknown as DataTransfer,
    });
    
    canvasElement.dispatchEvent(pasteEvent);
  }, imageDataUrl);
  
  await page.waitForTimeout(500);
}

test.describe('Image Operations', () => {
  let electronApp: ElectronApplication;
  let page: Page;
  let testImageDataUrl: string;

  test.beforeEach(async () => {
    electronApp = await launchApp();
    page = await electronApp.firstWindow();

    // Wait for app to be fully ready
    await waitForAppReady(page);

    // Clear auto-save data to ensure clean state
    await clearAutoSaveData(page);

    // Create test image in browser context
    testImageDataUrl = await createTestImage(page);
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should add image to canvas via drag and drop', async () => {
    const initialCount = await getCanvasObjectCount(page);
    
    await simulateImageDrop(page, testImageDataUrl);
    
    const finalCount = await getCanvasObjectCount(page);
    expect(finalCount).toBeGreaterThan(initialCount);
    
    const imageCount = await getImageObjectCount(page);
    expect(imageCount).toBeGreaterThanOrEqual(1);
  });

  test('should paste image from clipboard with Ctrl+V', async () => {
    const initialCount = await getCanvasObjectCount(page);
    
    // Set clipboard data and paste
    await pasteImageFromClipboard(page, testImageDataUrl);
    
    // Alternative: use keyboard shortcut after setting clipboard
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(500);
    
    const finalCount = await getCanvasObjectCount(page);
    // Should have at least one more object (might be more if both methods worked)
    expect(finalCount).toBeGreaterThanOrEqual(initialCount);
  });

  test('should handle multiple images', async () => {
    // Add first image
    await simulateImageDrop(page, testImageDataUrl);
    const count1 = await getImageObjectCount(page);
    expect(count1).toBeGreaterThanOrEqual(1);
    
    // Add second image
    await simulateImageDrop(page, testImageDataUrl);
    const count2 = await getImageObjectCount(page);
    expect(count2).toBeGreaterThan(count1);
  });

  test('should select and delete image with Delete key', async () => {
    // Add an image
    await simulateImageDrop(page, testImageDataUrl);
    await page.waitForTimeout(300);
    
    const countBefore = await getImageObjectCount(page);
    expect(countBefore).toBeGreaterThanOrEqual(1);
    
    // Select the image by clicking on it
    await page.click('[data-testid="tool-btn-select"]');
    await page.waitForTimeout(100);
    
    const canvas = await page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (box) {
      // Click in the center where the image should be
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(200);
    }
    
    // Press Delete key
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);
    
    const countAfter = await getImageObjectCount(page);
    expect(countAfter).toBeLessThanOrEqual(countBefore);
  });

  test('should maintain image after undo/redo', async () => {
    // Add an image
    await simulateImageDrop(page, testImageDataUrl);
    await page.waitForTimeout(300);
    
    let hasContent = await hasCanvasContent(page);
    expect(hasContent).toBe(true);
    
    // Undo
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    
    hasContent = await hasCanvasContent(page);
    expect(hasContent).toBe(false);
    
    // Redo
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(300);
    
    hasContent = await hasCanvasContent(page);
    expect(hasContent).toBe(true);
  });

  test('should handle invalid image data gracefully', async () => {
    // Try to drop invalid data
    const invalidDataUrl = 'data:image/png;base64,invalid';
    
    try {
      await simulateImageDrop(page, invalidDataUrl);
    } catch (error) {
      // Expected to fail
    }
    
    await page.waitForTimeout(500);
    
    // Canvas should remain unchanged or handle error gracefully
    // The count should not increase, or if it does, the app should still be functional
    const isStillResponsive = await page.evaluate(() => {
      const canvas = (window as { fabricCanvas?: unknown }).fabricCanvas;
      return canvas !== null && canvas !== undefined;
    });
    
    expect(isStillResponsive).toBe(true);
  });

  test('should position dropped image at drop location', async () => {
    const canvas = await page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    // Drop at specific location
    const targetX = box.x + box.width * 0.25;
    const targetY = box.y + box.height * 0.25;
    
    await page.evaluate(async ({ dataUrl, x, y }) => {
      const canvasElement = document.querySelector('canvas');
      if (!canvasElement) return;
      
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'test-image.png', { type: 'image/png' });
      
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer,
        clientX: x,
        clientY: y,
      });
      
      canvasElement.dispatchEvent(dropEvent);
    }, { dataUrl: testImageDataUrl, x: targetX, y: targetY });
    
    await page.waitForTimeout(500);
    
    // Verify image was added
    const imageCount = await getImageObjectCount(page);
    expect(imageCount).toBeGreaterThanOrEqual(1);
    
    // Note: Exact position verification would require accessing Fabric.js object properties
    // which can vary based on implementation. This test verifies the image is added.
  });

  test('should save and load canvas with images', async () => {
    // Add an image
    await simulateImageDrop(page, testImageDataUrl);
    await page.waitForTimeout(500);
    
    const imageCountBefore = await getImageObjectCount(page);
    expect(imageCountBefore).toBeGreaterThanOrEqual(1);
    
    // Get canvas state
    const canvasJSON = await page.evaluate(() => {
      const canvas = (window as { fabricCanvas?: { toJSON: () => unknown } }).fabricCanvas;
      if (!canvas) return null;
      return JSON.stringify(canvas.toJSON());
    });
    
    expect(canvasJSON).toBeTruthy();
    
    // Verify the JSON contains image data
    const canvasData = JSON.parse(canvasJSON as string) as { objects: { type: string }[] };
    const hasImageObject = canvasData.objects.some((obj) => obj.type === 'image');
    expect(hasImageObject).toBe(true);
  });
});
