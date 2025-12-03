import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI;

export const useAutoSaveStore = defineStore('autoSave', () => {
  // State
  const autoSave = ref<boolean>(true);
  const autoSaveInterval = ref<number>(30); // seconds
  const lastSaved = ref<Date | null>(null);
  const isSaving = ref<boolean>(false);

  // Computed
  const isEnabled = computed(() => autoSave.value);
  const intervalSeconds = computed(() => autoSaveInterval.value);

  // Load settings from Electron
  const loadSettings = async () => {
    if (isElectron) {
      try {
        const settings = await window.electronAPI.settings.load();
        autoSave.value = settings.autoSave;
        autoSaveInterval.value = settings.autoSaveInterval;
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

  async function setAutoSaveInterval(seconds: number) {
    if (seconds < 10) {
      console.warn('Auto-save interval must be at least 10 seconds');
      return;
    }
    autoSaveInterval.value = seconds;
    await saveSettings();
  }

  async function saveSettings() {
    if (isElectron) {
      try {
        const settings = await window.electronAPI.settings.load();
        await window.electronAPI.settings.save({
          ...settings,
          autoSave: autoSave.value,
          autoSaveInterval: autoSaveInterval.value,
        });
      } catch (error) {
        console.error('Failed to save auto-save settings:', error);
      }
    }
  }

  async function saveWhiteboardState(canvasData: any): Promise<boolean> {
    if (!isElectron) {
      return false;
    }

    isSaving.value = true;
    try {
      const success = await window.electronAPI.whiteboard.saveState(canvasData);
      if (success) {
        lastSaved.value = new Date();
      }
      return success;
    } catch (error) {
      console.error('Failed to save whiteboard state:', error);
      return false;
    } finally {
      isSaving.value = false;
    }
  }

  async function loadWhiteboardState() {
    if (!isElectron) {
      return null;
    }

    try {
      const state = await window.electronAPI.whiteboard.loadState();
      if (state) {
        lastSaved.value = new Date(state.savedAt);
      }
      return state;
    } catch (error) {
      console.error('Failed to load whiteboard state:', error);
      return null;
    }
  }

  async function deleteWhiteboardState(): Promise<boolean> {
    if (!isElectron) {
      return false;
    }

    try {
      const success = await window.electronAPI.whiteboard.deleteState();
      if (success) {
        lastSaved.value = null;
      }
      return success;
    } catch (error) {
      console.error('Failed to delete whiteboard state:', error);
      return false;
    }
  }

  // Initialize settings asynchronously
  loadSettings();

  return {
    // State
    autoSave,
    autoSaveInterval,
    lastSaved,
    isSaving,
    // Computed
    isEnabled,
    intervalSeconds,
    // Actions
    setAutoSave,
    setAutoSaveInterval,
    saveWhiteboardState,
    loadWhiteboardState,
    deleteWhiteboardState,
  };
});
