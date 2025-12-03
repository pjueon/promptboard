import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// Mock Electron API
const mockElectronAPI = {
  settings: {
    load: vi.fn().mockResolvedValue({ theme: 'light' }),
    save: vi.fn().mockResolvedValue(true),
  },
};

(global as any).window = {
  electronAPI: mockElectronAPI,
};

// Mock DOM methods
const mockClassList = {
  add: vi.fn(),
  remove: vi.fn(),
};

Object.defineProperty(global.document, 'documentElement', {
  value: { classList: mockClassList },
  writable: true,
});

Object.defineProperty(global.document, 'body', {
  value: { style: {} },
  writable: true,
});

describe('Theme Store', () => {
  beforeEach(async () => {
    // Clear module cache to reset store
    vi.resetModules();
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockElectronAPI.settings.load.mockResolvedValue({ theme: 'light' });
    mockClassList.add.mockClear();
    mockClassList.remove.mockClear();
  });

  describe('Initialization', () => {
    it('should have light theme as default', async () => {
      const { useThemeStore } = await import('../../src/renderer/stores/themeStore');
      const themeStore = useThemeStore();
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(themeStore.theme).toBe('light');
      expect(mockElectronAPI.settings.load).toHaveBeenCalled();
    });

    it('should load theme from Electron on init', async () => {
      mockElectronAPI.settings.load.mockResolvedValue({ theme: 'dark' });
      
      const { useThemeStore } = await import('../../src/renderer/stores/themeStore');
      const themeStore = useThemeStore();
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(themeStore.theme).toBe('dark');
      expect(mockElectronAPI.settings.load).toHaveBeenCalled();
    });

    it('should default to light if Electron load fails', async () => {
      mockElectronAPI.settings.load.mockRejectedValue(new Error('Load failed'));
      
      const { useThemeStore } = await import('../../src/renderer/stores/themeStore');
      const themeStore = useThemeStore();
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(themeStore.theme).toBe('light');
    });
  });

  describe('Theme Switching', () => {
    it('should switch from light to dark', async () => {
      const { useThemeStore } = await import('../../src/renderer/stores/themeStore');
      const themeStore = useThemeStore();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await themeStore.setTheme('dark');
      
      expect(themeStore.theme).toBe('dark');
      expect(mockElectronAPI.settings.save).toHaveBeenCalledWith({ theme: 'dark' });
    });

    it('should switch from dark to light', async () => {
      mockElectronAPI.settings.load.mockResolvedValue({ theme: 'dark' });
      const { useThemeStore } = await import('../../src/renderer/stores/themeStore');
      const themeStore = useThemeStore();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await themeStore.setTheme('light');
      
      expect(themeStore.theme).toBe('light');
      expect(mockElectronAPI.settings.save).toHaveBeenCalledWith({ theme: 'light' });
    });

    it('should toggle theme from light to dark', async () => {
      const { useThemeStore } = await import('../../src/renderer/stores/themeStore');
      const themeStore = useThemeStore();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await themeStore.toggleTheme();
      
      expect(themeStore.theme).toBe('dark');
    });

    it('should toggle theme from dark to light', async () => {
      mockElectronAPI.settings.load.mockResolvedValue({ theme: 'dark' });
      const { useThemeStore } = await import('../../src/renderer/stores/themeStore');
      const themeStore = useThemeStore();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await themeStore.toggleTheme();
      
      expect(themeStore.theme).toBe('light');
    });
  });

  describe('Electron Persistence', () => {
    it('should save theme to Electron when changed', async () => {
      const { useThemeStore } = await import('../../src/renderer/stores/themeStore');
      const themeStore = useThemeStore();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await themeStore.setTheme('dark');
      
      expect(mockElectronAPI.settings.save).toHaveBeenCalledWith({ theme: 'dark' });
    });

    it('should save theme when toggled', async () => {
      const { useThemeStore } = await import('../../src/renderer/stores/themeStore');
      const themeStore = useThemeStore();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await themeStore.toggleTheme();
      
      expect(mockElectronAPI.settings.save).toHaveBeenCalledWith({ theme: 'dark' });
    });

    it('should persist theme across store instances', async () => {
      mockElectronAPI.settings.load.mockResolvedValue({ theme: 'dark' });
      const { useThemeStore } = await import('../../src/renderer/stores/themeStore');
      const themeStore1 = useThemeStore();
      await new Promise(resolve => setTimeout(resolve, 50));
      await themeStore1.setTheme('dark');
      
      // Create new pinia instance to simulate app restart
      vi.resetModules();
      setActivePinia(createPinia());
      const { useThemeStore: useThemeStore2 } = await import('../../src/renderer/stores/themeStore');
      const themeStore2 = useThemeStore2();
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(themeStore2.theme).toBe('dark');
    });
  });

  describe('Computed Properties', () => {
    it('should have isDark as true when theme is dark', async () => {
      mockElectronAPI.settings.load.mockResolvedValue({ theme: 'dark' });
      const { useThemeStore } = await import('../../src/renderer/stores/themeStore');
      const themeStore = useThemeStore();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(themeStore.isDark).toBe(true);
    });

    it('should have isDark as false when theme is light', async () => {
      const { useThemeStore } = await import('../../src/renderer/stores/themeStore');
      const themeStore = useThemeStore();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(themeStore.isDark).toBe(false);
    });
  });
});
