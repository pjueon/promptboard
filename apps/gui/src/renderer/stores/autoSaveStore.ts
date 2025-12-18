import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI;

export const useAutoSaveStore = defineStore('autoSave', () => {
  // State
  const autoSave = ref<boolean>(true);
  const autoSaveDebounceMs = ref<number>(1000); // milliseconds

  // Computed
  const isEnabled = computed(() => autoSave.value);
  const debounceMs = computed(() => autoSaveDebounceMs.value);

  // Load settings from Electron
  const loadSettings = async () => {
    if (isElectron) {
      try {
        const settings = await window.electronAPI.settings.load();
        autoSave.value = settings.autoSave;
        autoSaveDebounceMs.value = settings.autoSaveDebounceMs || 1000;
      } catch (error) {
        console.error('Failed to load auto-save settings:', error);
      }
    }
  };

  // Actions
  async function setAutoSave(enabled: boolean) {
    autoSave.value = enabled;
    await saveSettings();
  }

  async function setAutoSaveDebounce(ms: number) {
    if (ms < 100) {
      console.warn('Auto-save debounce must be at least 100 milliseconds');
      return;
    }
    autoSaveDebounceMs.value = ms;
    await saveSettings();
  }

  async function saveSettings() {
    if (isElectron) {
      try {
        const settings = await window.electronAPI.settings.load();
        await window.electronAPI.settings.save({
          ...settings,
          autoSave: autoSave.value,
          autoSaveDebounceMs: autoSaveDebounceMs.value,
        });
      } catch (error) {
        console.error('Failed to save auto-save settings:', error);
      }
    }
  }

  // Save whiteboard canvas state
  async function saveWhiteboardState(canvasData: unknown) {
    if (isElectron) {
      try {
        // Pass canvasData directly - Electron will wrap it with metadata
        await window.electronAPI.whiteboard.saveState(canvasData);
      } catch (error) {
        console.error('Failed to save whiteboard state:', error);
      }
    }
  }

  // Load whiteboard canvas state
  async function loadWhiteboardState() {
    if (isElectron) {
      try {
        const state = await window.electronAPI.whiteboard.loadState();
        return state;
      } catch (error) {
        console.error('Failed to load whiteboard state:', error);
        return null;
      }
    }
    return null;
  }

  // Initialize settings asynchronously
  loadSettings();

  return {
    // State
    autoSave,
    autoSaveDebounceMs,
    // Computed
    isEnabled,
    debounceMs,
    // Actions
    setAutoSave,
    setAutoSaveDebounce,
    saveWhiteboardState,
    loadWhiteboardState,
  };
});
