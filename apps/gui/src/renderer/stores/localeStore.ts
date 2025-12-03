import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Locale } from '../i18n';

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI;

export const useLocaleStore = defineStore('locale', () => {
  const locale = ref<Locale>('en');
  const { locale: i18nLocale } = useI18n();

  // Load locale from Electron settings or localStorage
  const loadLocale = async (): Promise<Locale> => {
    if (isElectron) {
      try {
        const settings = await window.electronAPI.settings.load();
        return settings.locale;
      } catch (error) {
        console.error('Failed to load locale from Electron:', error);
        return 'en';
      }
    } else {
      // Fallback to localStorage for browser
      const stored = localStorage.getItem('promptboard-locale');
      if (stored === 'en' || stored === 'ko' || stored === 'ja') {
        return stored;
      }
      return 'en';
    }
  };

  // Actions
  async function setLocale(newLocale: Locale) {
    locale.value = newLocale;
    i18nLocale.value = newLocale;
    
    // Save to Electron or localStorage
    if (isElectron) {
      try {
        const settings = await window.electronAPI.settings.load();
        await window.electronAPI.settings.save({ ...settings, locale: newLocale });
      } catch (error) {
        console.error('Failed to save locale to Electron:', error);
      }
    } else {
      localStorage.setItem('promptboard-locale', newLocale);
    }
  }

  // Initialize locale asynchronously
  loadLocale().then((loadedLocale) => {
    locale.value = loadedLocale;
    i18nLocale.value = loadedLocale;
  });

  return {
    locale,
    setLocale,
  };
});
