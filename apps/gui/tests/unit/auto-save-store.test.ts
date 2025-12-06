import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// Mock Electron API
const mockElectronAPI = {
  settings: {
    load: vi.fn().mockResolvedValue({
      theme: 'light',
      locale: 'en',
      autoSave: true,
      autoSaveDebounceMs: 1000,
    }),
    save: vi.fn().mockResolvedValue(true),
  },
  whiteboard: {
    saveState: vi.fn().mockResolvedValue(true),
    loadState: vi.fn().mockResolvedValue(null),
    deleteState: vi.fn().mockResolvedValue(true),
  },
};

interface GlobalWithWindow {
  window: {
    electronAPI: typeof mockElectronAPI;
  };
}

(global as unknown as GlobalWithWindow).window = {
  electronAPI: mockElectronAPI,
};

describe('Auto-save Store - Event-driven', () => {
  beforeEach(async () => {
    vi.resetModules();
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockElectronAPI.settings.load.mockResolvedValue({
      theme: 'light',
      locale: 'en',
      autoSave: true,
      autoSaveDebounceMs: 1000,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should load settings with debounce value', async () => {
      const { useAutoSaveStore } = await import('../../src/renderer/stores/autoSaveStore');
      const autoSaveStore = useAutoSaveStore();

      await vi.advanceTimersByTimeAsync(50);

      expect(mockElectronAPI.settings.load).toHaveBeenCalled();
      expect(autoSaveStore.autoSaveDebounceMs).toBe(1000);
    });

    it('should default to 1000ms if load fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockElectronAPI.settings.load.mockRejectedValue(new Error('Load failed'));

      const { useAutoSaveStore } = await import('../../src/renderer/stores/autoSaveStore');
      const autoSaveStore = useAutoSaveStore();

      await vi.advanceTimersByTimeAsync(50);

      expect(autoSaveStore.autoSaveDebounceMs).toBe(1000);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Debounce configuration', () => {
    it('should allow changing debounce time', async () => {
      const { useAutoSaveStore } = await import('../../src/renderer/stores/autoSaveStore');
      const autoSaveStore = useAutoSaveStore();
      await vi.advanceTimersByTimeAsync(50);

      await autoSaveStore.setAutoSaveDebounce(2000);

      expect(autoSaveStore.autoSaveDebounceMs).toBe(2000);
    });

    it('should enforce minimum debounce (100ms)', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { useAutoSaveStore } = await import('../../src/renderer/stores/autoSaveStore');
      const autoSaveStore = useAutoSaveStore();
      await vi.advanceTimersByTimeAsync(50);

      const originalValue = autoSaveStore.autoSaveDebounceMs;
      await autoSaveStore.setAutoSaveDebounce(50);

      expect(autoSaveStore.autoSaveDebounceMs).toBe(originalValue);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('100'));
      consoleWarnSpy.mockRestore();
    });

    it('should save debounce setting to Electron', async () => {
      const { useAutoSaveStore } = await import('../../src/renderer/stores/autoSaveStore');
      const autoSaveStore = useAutoSaveStore();
      await vi.advanceTimersByTimeAsync(50);

      await autoSaveStore.setAutoSaveDebounce(1500);

      expect(mockElectronAPI.settings.save).toHaveBeenCalledWith(
        expect.objectContaining({
          autoSaveDebounceMs: 1500,
        })
      );
    });
  });

  describe('Event-driven save', () => {
    it('should trigger save when history changes', async () => {
      const { useAutoSaveStore } = await import('../../src/renderer/stores/autoSaveStore');
      const { useHistoryStore } = await import('../../src/renderer/stores/historyStore');

      const autoSaveStore = useAutoSaveStore();
      const historyStore = useHistoryStore();

      await vi.advanceTimersByTimeAsync(50);

      // Setup history watcher
      const canvasData = { objects: [], version: '5.3.0' };
      autoSaveStore.setupHistoryWatcher(historyStore, () => canvasData);

      // Trigger history change
      historyStore.saveSnapshot('data:image/png;base64,test');

      // Should not save immediately
      expect(mockElectronAPI.whiteboard.saveState).not.toHaveBeenCalled();

      // Wait for debounce
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockElectronAPI.whiteboard.saveState).toHaveBeenCalledWith(canvasData);
    });

    it('should debounce multiple rapid changes', async () => {
      const { useAutoSaveStore } = await import('../../src/renderer/stores/autoSaveStore');
      const { useHistoryStore } = await import('../../src/renderer/stores/historyStore');

      const autoSaveStore = useAutoSaveStore();
      const historyStore = useHistoryStore();

      await vi.advanceTimersByTimeAsync(50);

      const canvasData = { objects: [], version: '5.3.0' };
      autoSaveStore.setupHistoryWatcher(historyStore, () => canvasData);

      // Rapid history changes
      for (let i = 0; i < 10; i++) {
        historyStore.saveSnapshot(`data:image/png;base64,test${i}`);
        await vi.advanceTimersByTimeAsync(100);
      }

      // Should not have saved yet
      expect(mockElectronAPI.whiteboard.saveState).not.toHaveBeenCalled();

      // Wait for final debounce
      await vi.advanceTimersByTimeAsync(1000);

      // Should only save once
      expect(mockElectronAPI.whiteboard.saveState).toHaveBeenCalledTimes(1);
    });

    it('should respect debounce timing', async () => {
      mockElectronAPI.settings.load.mockResolvedValue({
        theme: 'light',
        locale: 'en',
        autoSave: true,
        autoSaveDebounceMs: 500,
      });

      const { useAutoSaveStore } = await import('../../src/renderer/stores/autoSaveStore');
      const { useHistoryStore } = await import('../../src/renderer/stores/historyStore');

      const autoSaveStore = useAutoSaveStore();
      const historyStore = useHistoryStore();

      await vi.advanceTimersByTimeAsync(50);

      const canvasData = { objects: [], version: '5.3.0' };
      autoSaveStore.setupHistoryWatcher(historyStore, () => canvasData);

      historyStore.saveSnapshot('data:image/png;base64,test');

      // Should not save before debounce time
      await vi.advanceTimersByTimeAsync(400);
      expect(mockElectronAPI.whiteboard.saveState).not.toHaveBeenCalled();

      // Should save after debounce time
      await vi.advanceTimersByTimeAsync(100);
      expect(mockElectronAPI.whiteboard.saveState).toHaveBeenCalled();
    });

    it('should not save when auto-save is disabled', async () => {
      const { useAutoSaveStore } = await import('../../src/renderer/stores/autoSaveStore');
      const { useHistoryStore } = await import('../../src/renderer/stores/historyStore');

      const autoSaveStore = useAutoSaveStore();
      const historyStore = useHistoryStore();

      await vi.advanceTimersByTimeAsync(50);

      // Disable auto-save
      await autoSaveStore.setAutoSave(false);

      const canvasData = { objects: [], version: '5.3.0' };
      autoSaveStore.setupHistoryWatcher(historyStore, () => canvasData);

      historyStore.saveSnapshot('data:image/png;base64,test');
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockElectronAPI.whiteboard.saveState).not.toHaveBeenCalled();
    });
  });

  describe('Immediate save', () => {
    it('should provide method to save immediately (bypass debounce)', async () => {
      const { useAutoSaveStore } = await import('../../src/renderer/stores/autoSaveStore');

      const autoSaveStore = useAutoSaveStore();
      await vi.advanceTimersByTimeAsync(50);

      const canvasData = { objects: [], version: '5.3.0' };
      await autoSaveStore.performAutoSaveImmediately(canvasData);

      // Should save immediately without waiting for debounce
      expect(mockElectronAPI.whiteboard.saveState).toHaveBeenCalledWith(canvasData);
    });

    it('should save immediately even if debounced save is pending', async () => {
      const { useAutoSaveStore } = await import('../../src/renderer/stores/autoSaveStore');
      const { useHistoryStore } = await import('../../src/renderer/stores/historyStore');

      const autoSaveStore = useAutoSaveStore();
      const historyStore = useHistoryStore();

      await vi.advanceTimersByTimeAsync(50);

      const canvasData = { objects: [], version: '5.3.0' };
      const unsubscribe = autoSaveStore.setupHistoryWatcher(historyStore, () => canvasData);

      // Trigger debounced save
      historyStore.saveSnapshot('data:image/png;base64,test');

      // Cleanup watcher before immediate save (realistic unmount scenario)
      unsubscribe();

      // Immediately save (as done on unmount)
      await autoSaveStore.performAutoSaveImmediately(canvasData);

      expect(mockElectronAPI.whiteboard.saveState).toHaveBeenCalledTimes(1);

      // Wait for debounce time
      await vi.advanceTimersByTimeAsync(1000);

      // Should still only have saved once (watcher was cleaned up)
      expect(mockElectronAPI.whiteboard.saveState).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup watcher on teardown', async () => {
      const { useAutoSaveStore } = await import('../../src/renderer/stores/autoSaveStore');
      const { useHistoryStore } = await import('../../src/renderer/stores/historyStore');

      const autoSaveStore = useAutoSaveStore();
      const historyStore = useHistoryStore();

      await vi.advanceTimersByTimeAsync(50);

      const canvasData = { objects: [], version: '5.3.0' };
      const unsubscribe = autoSaveStore.setupHistoryWatcher(historyStore, () => canvasData);

      // Cleanup
      unsubscribe();

      // Trigger history change after cleanup
      historyStore.saveSnapshot('data:image/png;base64,test');
      await vi.advanceTimersByTimeAsync(1000);

      // Should not save after cleanup
      expect(mockElectronAPI.whiteboard.saveState).not.toHaveBeenCalled();
    });
  });
});
