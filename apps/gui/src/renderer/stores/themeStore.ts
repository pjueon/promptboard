import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type Theme = 'light' | 'dark';

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI;

export const useThemeStore = defineStore('theme', () => {
  // Load theme from Electron settings or localStorage
  const loadTheme = async (): Promise<Theme> => {
    if (isElectron) {
      try {
        const settings = await window.electronAPI.settings.load();
        return settings.theme;
      } catch (error) {
        console.error('Failed to load theme from Electron:', error);
        return 'light';
      }
    } else {
      // Fallback to localStorage for browser
      const stored = localStorage.getItem('promptboard-theme');
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
      return 'light';
    }
  };

  // State
  const theme = ref<Theme>('light');

  // Computed
  const isDark = computed(() => theme.value === 'dark');

  // Actions
  async function setTheme(newTheme: Theme) {
    theme.value = newTheme;

    // Save to Electron or localStorage
    if (isElectron) {
      try {
        // Load current settings first to preserve other values
        const currentSettings = await window.electronAPI.settings.load();
        await window.electronAPI.settings.save({ ...currentSettings, theme: newTheme });
      } catch (error) {
        console.error('Failed to save theme to Electron:', error);
      }
    } else {
      localStorage.setItem('promptboard-theme', newTheme);
    }

    applyThemeToDOM(newTheme);
  }

  async function toggleTheme() {
    const newTheme = theme.value === 'light' ? 'dark' : 'light';
    await setTheme(newTheme);
  }

  function applyThemeToDOM(themeValue: Theme) {
    if (themeValue === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  // Initialize theme asynchronously
  loadTheme().then((loadedTheme) => {
    theme.value = loadedTheme;
    applyThemeToDOM(loadedTheme);
  });

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme,
  };
});
