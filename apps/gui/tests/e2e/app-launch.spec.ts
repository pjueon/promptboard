import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Sample E2E Test
 * Check if the Electron app starts correctly
 */
test.describe('Electron App Launch', () => {
  test('should launch electron app', async () => {
    // Start Electron app
    const electronApp = await electron.launch({
      args: [
        path.join(__dirname, '../../dist-electron/main/index.mjs'),
        ...(process.env.CI ? ['--no-sandbox'] : []),
      ],
    });

    // Wait for the first window
    const window = await electronApp.firstWindow();

    // Check if the window exists
    expect(window).toBeTruthy();

    // Check the title
    const title = await window.title();
    expect(title).toBeTruthy();

    // Close the app
    await electronApp.close();
  });

  test('should have correct window dimensions', async () => {
    const electronApp = await electron.launch({
      args: [
        path.join(__dirname, '../../dist-electron/main/index.mjs'),
        ...(process.env.CI ? ['--no-sandbox'] : []),
      ],
    });

        

        await electronApp.firstWindow();    
    // Check dimensions using BrowserWindow's getBounds()
    const bounds = await electronApp.evaluate(({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      return windows[0]?.getBounds() || { width: 0, height: 0 };
    });

    // Check minimum dimensions
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);

    await electronApp.close();
  });
});
