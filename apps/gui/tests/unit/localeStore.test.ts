import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// Mock Electron API
const mockElectronAPI = {
  settings: {
    load: vi.fn().mockResolvedValue({ locale: 'en' }),
    save: vi.fn().mockResolvedValue(true),
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

// Mock i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: { value: 'en' },
  }),
}));

describe('Locale Store', () => {
  beforeEach(async () => {
    // Clear module cache to reset store
    vi.resetModules();
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockElectronAPI.settings.load.mockResolvedValue({ locale: 'en' });
  });

  describe('Initialization', () => {
    it('should have English as default locale', async () => {
      const { useLocaleStore } = await import('../../src/renderer/stores/localeStore');
      const localeStore = useLocaleStore();
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(localeStore.locale).toBe('en');
      expect(mockElectronAPI.settings.load).toHaveBeenCalled();
    });

    it('should load locale from Electron on init', async () => {
      mockElectronAPI.settings.load.mockResolvedValue({ locale: 'ko' });
      
      const { useLocaleStore } = await import('../../src/renderer/stores/localeStore');
      const localeStore = useLocaleStore();
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(localeStore.locale).toBe('ko');
      expect(mockElectronAPI.settings.load).toHaveBeenCalled();
    });

    it('should load Japanese locale from Electron', async () => {
      mockElectronAPI.settings.load.mockResolvedValue({ locale: 'ja' });
      
      const { useLocaleStore } = await import('../../src/renderer/stores/localeStore');
      const localeStore = useLocaleStore();
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(localeStore.locale).toBe('ja');
      expect(mockElectronAPI.settings.load).toHaveBeenCalled();
    });

    it('should default to English if Electron load fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockElectronAPI.settings.load.mockRejectedValue(new Error('Load failed'));
      
      const { useLocaleStore } = await import('../../src/renderer/stores/localeStore');
      const localeStore = useLocaleStore();
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(localeStore.locale).toBe('en');
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Locale Switching', () => {
    it('should switch from English to Korean', async () => {
      const { useLocaleStore } = await import('../../src/renderer/stores/localeStore');
      const localeStore = useLocaleStore();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await localeStore.setLocale('ko');
      
      expect(localeStore.locale).toBe('ko');
      expect(mockElectronAPI.settings.save).toHaveBeenCalledWith({ locale: 'ko' });
    });

    it('should switch from Korean to English', async () => {
      mockElectronAPI.settings.load.mockResolvedValue({ locale: 'ko' });
      const { useLocaleStore } = await import('../../src/renderer/stores/localeStore');
      const localeStore = useLocaleStore();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await localeStore.setLocale('en');
      
      expect(localeStore.locale).toBe('en');
      expect(mockElectronAPI.settings.save).toHaveBeenCalledWith({ locale: 'en' });
    });

    it('should switch to Japanese', async () => {
      const { useLocaleStore } = await import('../../src/renderer/stores/localeStore');
      const localeStore = useLocaleStore();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await localeStore.setLocale('ja');
      
      expect(localeStore.locale).toBe('ja');
      expect(mockElectronAPI.settings.save).toHaveBeenCalledWith({ locale: 'ja' });
    });
  });

  describe('Electron Persistence', () => {
    it('should save locale to Electron when changed', async () => {
      const { useLocaleStore } = await import('../../src/renderer/stores/localeStore');
      const localeStore = useLocaleStore();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await localeStore.setLocale('ko');
      
      expect(mockElectronAPI.settings.save).toHaveBeenCalledWith({ locale: 'ko' });
    });

    it('should handle save errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockElectronAPI.settings.save.mockRejectedValue(new Error('Save failed'));
      
      const { useLocaleStore } = await import('../../src/renderer/stores/localeStore');
      const localeStore = useLocaleStore();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Should not throw even if save fails
      await expect(localeStore.setLocale('ko')).resolves.not.toThrow();
      
      // But locale should still be updated in memory
      expect(localeStore.locale).toBe('ko');
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Locale Cycle', () => {
    it('should cycle through all supported locales', async () => {
      const { useLocaleStore } = await import('../../src/renderer/stores/localeStore');
      const localeStore = useLocaleStore();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // en -> ko -> ja -> en
      await localeStore.setLocale('ko');
      expect(localeStore.locale).toBe('ko');
      
      await localeStore.setLocale('ja');
      expect(localeStore.locale).toBe('ja');
      
      await localeStore.setLocale('en');
      expect(localeStore.locale).toBe('en');
    });
  });
});
