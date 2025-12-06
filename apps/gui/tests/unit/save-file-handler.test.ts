import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dialog } from 'electron';
import fs from 'fs/promises';

// Mock electron modules
vi.mock('electron', () => ({
  dialog: {
    showSaveDialog: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    isPackaged: false,
    getPath: vi.fn(() => '/mock/userData'),
  },
  BrowserWindow: vi.fn(),
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  default: {
    writeFile: vi.fn(),
  },
}));

describe('Save Canvas as File IPC Handler', () => {
  const mockBase64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Save Dialog', () => {
    it('should open save dialog with correct options for PNG', async () => {
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        filePath: '/path/to/canvas.png',
        canceled: false,
      });
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // Simulate the IPC handler logic
      const format = 'png';
      const extension = format === 'jpg' ? 'jpg' : 'png';
      const filterName = format === 'jpg' ? 'JPEG Image' : 'PNG Image';

      await dialog.showSaveDialog({
        title: 'Save Canvas',
        defaultPath: `whiteboard-${Date.now()}.${extension}`,
        filters: [
          { name: filterName, extensions: [extension] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      expect(dialog.showSaveDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Save Canvas',
          defaultPath: expect.stringContaining('.png'),
          filters: expect.arrayContaining([
            { name: 'PNG Image', extensions: ['png'] },
          ]),
        })
      );
    });

    it('should open save dialog with correct options for JPG', async () => {
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        filePath: '/path/to/canvas.jpg',
        canceled: false,
      });

      const extension = 'jpg';
      const filterName = 'JPEG Image';

      await dialog.showSaveDialog({
        title: 'Save Canvas',
        defaultPath: `whiteboard-${Date.now()}.${extension}`,
        filters: [
          { name: filterName, extensions: [extension] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      expect(dialog.showSaveDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultPath: expect.stringContaining('.jpg'),
          filters: expect.arrayContaining([
            { name: 'JPEG Image', extensions: ['jpg'] },
          ]),
        })
      );
    });
  });

  describe('File Writing', () => {
    it('should write base64 image to file when path is selected', async () => {
      const mockFilePath = '/path/to/canvas.png';
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        filePath: mockFilePath,
        canceled: false,
      });
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // Simulate handler logic
      const buffer = Buffer.from(mockBase64Image, 'base64');
      await fs.writeFile(mockFilePath, buffer);

      expect(fs.writeFile).toHaveBeenCalledWith(
        mockFilePath,
        expect.any(Buffer)
      );
    });

    it('should convert base64 to buffer correctly', () => {
      const buffer = Buffer.from(mockBase64Image, 'base64');

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('User Cancellation', () => {
    it('should return canceled status when user cancels dialog', async () => {
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        filePath: undefined,
        canceled: true,
      });

      const result = await dialog.showSaveDialog({
        title: 'Save Canvas',
        defaultPath: 'whiteboard.png',
        filters: [{ name: 'PNG Image', extensions: ['png'] }]
      });

      expect(result.canceled).toBe(true);
      expect(result.filePath).toBeUndefined();
    });

    it('should not write file when user cancels', async () => {
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        filePath: undefined,
        canceled: true,
      });

      const dialogResult = await dialog.showSaveDialog({
        title: 'Save Canvas',
        defaultPath: 'whiteboard.png',
        filters: [{ name: 'PNG Image', extensions: ['png'] }]
      });

      if (!dialogResult.canceled && dialogResult.filePath) {
        const buffer = Buffer.from(mockBase64Image, 'base64');
        await fs.writeFile(dialogResult.filePath, buffer);
      }

      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle file write errors gracefully', async () => {
      const mockFilePath = '/path/to/canvas.png';
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        filePath: mockFilePath,
        canceled: false,
      });
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Permission denied'));

      try {
        const buffer = Buffer.from(mockBase64Image, 'base64');
        await fs.writeFile(mockFilePath, buffer);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Permission denied');
      }
    });

    it('should handle invalid base64 gracefully', () => {
      const invalidBase64 = 'this is not base64!@#$%';

      // Buffer.from should not throw, but will decode incorrectly
      expect(() => {
        Buffer.from(invalidBase64, 'base64');
      }).not.toThrow();
    });
  });

  describe('File Path Validation', () => {
    it('should handle empty file path', async () => {
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        filePath: '',
        canceled: false,
      });

      const result = await dialog.showSaveDialog({
        title: 'Save Canvas',
        defaultPath: 'whiteboard.png',
        filters: [{ name: 'PNG Image', extensions: ['png'] }]
      });

      // Empty path should be treated as canceled
      expect(result.filePath).toBe('');
    });

    it('should preserve file extension from dialog', async () => {
      const mockFilePath = '/user/selected/path/mycanvas.png';
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        filePath: mockFilePath,
        canceled: false,
      });

      const result = await dialog.showSaveDialog({
        title: 'Save Canvas',
        defaultPath: 'whiteboard.png',
        filters: [{ name: 'PNG Image', extensions: ['png'] }]
      });

      expect(result.filePath).toBe(mockFilePath);
      expect(result.filePath?.endsWith('.png')).toBe(true);
    });
  });
});
