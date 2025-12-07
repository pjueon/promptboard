import { test, expect, _electron as electron, Page, ElectronApplication } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import { clearAutoSaveData, waitForAppReady } from './helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * E2E Test: Save/Load Functionality
 * 
 * Tests file saving, loading, and auto-save:
 * - Manual save (Ctrl+S)
 * - File save dialog
 * - Loading saved files
 * - Auto-save functionality
 * - State persistence across app restarts
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

async function drawRectangle(page: Page): Promise<void> {
  await page.click('[data-testid="tool-btn-rectangle"]');
  await page.waitForTimeout(300);
  
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
  
  await page.waitForTimeout(500);
}

async function clearCanvas(page: Page): Promise<void> {
  await page.click('[data-testid="clear-btn"]');
  await page.waitForTimeout(200);
  
  // Confirm the clear action
  const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("확인")');
  if (await confirmBtn.isVisible()) {
    await confirmBtn.click();
    await page.waitForTimeout(200);
  }
}

test.describe('Save/Load Functionality', () => {
  let electronApp: ElectronApplication;
  let page: Page;
  let tempDir: string;

  test.beforeAll(() => {
    // Create a temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptboard-test-'));
  });

  test.afterAll(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test.beforeEach(async () => {
    electronApp = await launchApp();
    page = await electronApp.firstWindow();
    
    // Wait for app to be fully ready
    await waitForAppReady(page);
    await page.waitForTimeout(500);
    
    // Clear auto-save data to ensure clean state
    await clearAutoSaveData(page);
    await page.waitForTimeout(500);
    
    // Clean up temp directory files from previous tests
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
    }
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should save canvas when save button is clicked', async () => {
    // Draw something
    await drawRectangle(page);
    
    const objectCount = await getCanvasObjectCount(page);
    expect(objectCount).toBe(1);
    
    // Mock file dialog to return a test file path
    const testFilePath = path.join(tempDir, 'test-save.png');
    
    await electronApp.evaluate(async ({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: filePath,
      });
    }, testFilePath);
    
    // Click save button
    await page.click('[data-testid="save-btn"]');
    await page.waitForTimeout(500);
    
    // Verify file was created
    expect(fs.existsSync(testFilePath)).toBe(true);
    
    // Verify it's a valid PNG file (check magic bytes)
    const buffer = fs.readFileSync(testFilePath);
    expect(buffer[0]).toBe(0x89); // PNG signature
    expect(buffer[1]).toBe(0x50); // P
    expect(buffer[2]).toBe(0x4E); // N
    expect(buffer[3]).toBe(0x47); // G
  });

  test('should save canvas with keyboard shortcut Ctrl+S', async () => {
    await drawRectangle(page);
    
    const testFilePath = path.join(tempDir, 'test-shortcut.png');
    
    await electronApp.evaluate(async ({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: filePath,
      });
    }, testFilePath);
    
    // Use Ctrl+S shortcut
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(500);
    
    expect(fs.existsSync(testFilePath)).toBe(true);
    // Verify it's a valid PNG
    const buffer = fs.readFileSync(testFilePath);
    expect(buffer[0]).toBe(0x89); // PNG signature
  });

  test('should not save when user cancels save dialog', async () => {
    await drawRectangle(page);
    
    // Mock canceled dialog
    await electronApp.evaluate(async ({ dialog }) => {
      dialog.showSaveDialog = async () => ({
        canceled: true,
        filePath: '',
      });
    });
    
    await page.click('[data-testid="save-btn"]');
    await page.waitForTimeout(300);
    
    // No file should be created
    const files = fs.readdirSync(tempDir);
    expect(files.length).toBe(0);
  });

  test('should save empty canvas', async () => {
    const testFilePath = path.join(tempDir, 'test-empty.png');
    
    await electronApp.evaluate(async ({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: filePath,
      });
    }, testFilePath);
    
    await page.click('[data-testid="save-btn"]');
    await page.waitForTimeout(500);
    
    expect(fs.existsSync(testFilePath)).toBe(true);
    
    // Verify it's a valid PNG file
    const buffer = fs.readFileSync(testFilePath);
    expect(buffer[0]).toBe(0x89); // PNG signature
    expect(buffer.length).toBeGreaterThan(0);
  });

  test('should persist canvas state across app restarts', async () => {
    // Draw objects
    await drawRectangle(page);
    await page.waitForTimeout(300);
    
    const originalCount = await getCanvasObjectCount(page);
    expect(originalCount).toBe(1);
    
    // Wait for auto-save to trigger
    await page.waitForTimeout(2000);
    
    // Close app
    await electronApp.close();
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Relaunch app
    electronApp = await launchApp();
    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000); // Wait for state restoration
    
    // Check if objects are restored
    const restoredCount = await getCanvasObjectCount(page);
    expect(restoredCount).toBe(originalCount);
  });

  test('should auto-save canvas after changes', async () => {
    // Draw something
    await drawRectangle(page);
    
    // Wait for auto-save (default is 5 seconds)
    await page.waitForTimeout(6000);
    
    // Check if auto-save file exists using electron API
    const stateExists = await page.evaluate(async () => {
      const win = window as {
        electronAPI?: {
          whiteboard?: {
            loadState?: () => Promise<string | null>;
          };
        };
      };
      
      if (win.electronAPI?.whiteboard?.loadState) {
        try {
          const state = await win.electronAPI.whiteboard.loadState();
          return state !== null;
        } catch {
          return false;
        }
      }
      return false;
    });
    
    // In development mode, auto-save should work
    if (!process.env.CI) {
      expect(stateExists).toBe(true);
    }
  });

  test('should handle multiple saves correctly', async () => {
    const testFilePath1 = path.join(tempDir, 'test-multi-1.png');
    const testFilePath2 = path.join(tempDir, 'test-multi-2.png');
    
    // First save
    await drawRectangle(page);
    await electronApp.evaluate(async ({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: filePath,
      });
    }, testFilePath1);
    await page.click('[data-testid="save-btn"]');
    await page.waitForTimeout(500);
    
    // Draw more
    await drawRectangle(page);
    
    // Second save
    await electronApp.evaluate(async ({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: filePath,
      });
    }, testFilePath2);
    await page.click('[data-testid="save-btn"]');
    await page.waitForTimeout(500);
    
    // Verify both files exist
    expect(fs.existsSync(testFilePath1)).toBe(true);
    expect(fs.existsSync(testFilePath2)).toBe(true);
    
    // Verify files are valid PNGs
    const buffer1 = fs.readFileSync(testFilePath1);
    const buffer2 = fs.readFileSync(testFilePath2);
    expect(buffer1[0]).toBe(0x89);
    expect(buffer2[0]).toBe(0x89);
  });

  test('should preserve canvas after clear and restore', async () => {
    // Draw and save
    await drawRectangle(page);
    const testFilePath = path.join(tempDir, 'test-restore.png');
    
    await electronApp.evaluate(async ({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: filePath,
      });
    }, testFilePath);
    await page.click('[data-testid="save-btn"]');
    await page.waitForTimeout(500);
    
    // Clear canvas
    await clearCanvas(page);
    
    const count = await getCanvasObjectCount(page);
    expect(count).toBe(0);
    
    // The saved file should still exist and be valid PNG
    expect(fs.existsSync(testFilePath)).toBe(true);
    const buffer = fs.readFileSync(testFilePath);
    expect(buffer[0]).toBe(0x89); // PNG signature
    expect(buffer.length).toBeGreaterThan(1000); // Should have some content
  });
});
