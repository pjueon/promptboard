import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import { app } from 'electron';
import type { WhiteboardState, FabricCanvasData } from '../../electron/main/whiteboard-state';

// Mock electron modules
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn((name: string) => {
      if (name === 'userData') {
        return '/mock/userData';
      }
      return '/mock';
    }),
  },
}));

// Mock fs module
vi.mock('fs', () => {
  const fsMock = {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
  return {
    ...fsMock,
    default: fsMock,
  };
});

describe('Whiteboard State', () => {
  let loadWhiteboardState: () => WhiteboardState | null;
  let saveWhiteboardState: (canvasData: FabricCanvasData) => boolean;
  let deleteWhiteboardState: () => boolean;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Import fresh module instance
    const module = await import('../../electron/main/whiteboard-state');
    loadWhiteboardState = module.loadWhiteboardState;
    saveWhiteboardState = module.saveWhiteboardState;
    deleteWhiteboardState = module.deleteWhiteboardState;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loadWhiteboardState', () => {
    it('should return null if state file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = loadWhiteboardState();

      expect(result).toBeNull();
      expect(fs.existsSync).toHaveBeenCalled();
    });

    it('should load valid state from file', () => {
      const mockState = {
        version: '1.0.0',
        canvasData: { objects: [] },
        savedAt: '2024-01-01T00:00:00.000Z',
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockState));

      const result = loadWhiteboardState();

      expect(result).toEqual(mockState);
      expect(fs.readFileSync).toHaveBeenCalled();
    });

    it('should return null if state file is corrupted', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json');

      const result = loadWhiteboardState();

      expect(result).toBeNull();
      consoleErrorSpy.mockRestore();
    });

    it('should return null if state structure is invalid', () => {
      const invalidState = {
        version: '1.0.0',
        // missing canvasData and savedAt
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(invalidState));

      const result = loadWhiteboardState();

      expect(result).toBeNull();
    });

    it('should use userData directory in development mode', () => {
      // app.isPackaged is already false by default in mock
      vi.mocked(fs.existsSync).mockReturnValue(false);

      loadWhiteboardState();

      expect(app.getPath).toHaveBeenCalledWith('userData');
    });
  });

  describe('saveWhiteboardState', () => {
    it('should save canvas data to file', () => {
      const mockCanvasData = { objects: [{ type: 'rect' }] };
      vi.mocked(fs.writeFileSync).mockReturnValue();

      const result = saveWhiteboardState(mockCanvasData);

      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('whiteboard-state.json'),
        expect.stringContaining('"version"'),
        'utf-8'
      );
    });

    it('should include version and timestamp in saved state', () => {
      const mockCanvasData = { objects: [] };
      vi.mocked(fs.writeFileSync).mockReturnValue();

      const dateSpy = vi.spyOn(Date.prototype, 'toISOString');

      saveWhiteboardState(mockCanvasData);

      expect(dateSpy).toHaveBeenCalled();

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const savedData = JSON.parse(writeCall[1] as string);

      expect(savedData.version).toBe('1.0.0');
      expect(savedData.canvasData).toEqual(mockCanvasData);
      expect(savedData.savedAt).toBeDefined();
    });

    it('should return false if write fails', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockCanvasData = { objects: [] };
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Write failed');
      });

      const result = saveWhiteboardState(mockCanvasData);

      expect(result).toBe(false);
      consoleErrorSpy.mockRestore();
    });

    it('should use userData directory in development mode', () => {
      // app.isPackaged is already false by default in mock
      vi.mocked(fs.writeFileSync).mockReturnValue();

      saveWhiteboardState({ objects: [] });

      expect(app.getPath).toHaveBeenCalledWith('userData');
    });
  });

  describe('deleteWhiteboardState', () => {
    it('should delete state file if it exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.unlinkSync).mockReturnValue();

      const result = deleteWhiteboardState();

      expect(result).toBe(true);
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('should return true if state file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = deleteWhiteboardState();

      expect(result).toBe(true);
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should return false if delete fails', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.unlinkSync).mockImplementation(() => {
        throw new Error('Delete failed');
      });

      const result = deleteWhiteboardState();

      expect(result).toBe(false);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Portability', () => {
    it('should use executable directory in production mode', async () => {
      const isPackagedSpy = vi.spyOn(app, 'isPackaged', 'get').mockReturnValue(true);

      const testExecPath = process.platform === 'win32'
        ? 'C:\\Users\\test\\Promptboard.exe'
        : '/home/test/Promptboard';

      Object.defineProperty(process, 'execPath', {
        value: testExecPath,
        configurable: true,
      });

      vi.mocked(fs.writeFileSync).mockReturnValue();

      // Re-import module to get production-mode behavior
      // Note: With the spy in place, we don't need to vi.resetModules() here.
      // We just need to ensure the logic inside saveWhiteboardState re-evaluates the path.
      const module = await import('../../electron/main/whiteboard-state');
      module.saveWhiteboardState({ objects: [] });

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const filePath = writeCall[0] as string;

      // Should be in exe directory, not userData
      expect(filePath).toContain('test');
      expect(filePath).toContain('whiteboard-state.json');

      // Restore the original property
      isPackagedSpy.mockRestore();
    });
  });
});
