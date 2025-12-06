import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { debounce, type DebouncedFunction } from '../utils/debounce';
import type { useHistoryStore } from './historyStore';

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI;

export const useAutoSaveStore = defineStore('autoSave', () => {
  // State
  const autoSave = ref<boolean>(true);
  const autoSaveDebounceMs = ref<number>(1000); // milliseconds
  const lastSaved = ref<Date | null>(null);
  const isSaving = ref<boolean>(false);

  // Debounced save function (will be initialized in setupHistoryWatcher)
  let debouncedSave: DebouncedFunction<() => Promise<void>> | null = null;
  let getCanvasDataFn: (() => object) | null = null;

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

    // Recreate debounced function with new timing if watcher is active
    if (debouncedSave && getCanvasDataFn) {
      debouncedSave.cancel();
      debouncedSave = debounce(performAutoSave, autoSaveDebounceMs.value);
    }
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

  async function saveWhiteboardState(canvasData: object): Promise<boolean> {
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

  /**
   * Internal function to perform auto-save
   */
  async function performAutoSave() {
    if (!autoSave.value || !getCanvasDataFn) {
      return;
    }

    try {
      const canvasData = getCanvasDataFn();
      await saveWhiteboardState(canvasData);
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }

  /**
   * Perform auto-save immediately, bypassing debounce
   */
  async function performAutoSaveImmediately(canvasData: object): Promise<void> {
    // Cancel any pending debounced save
    if (debouncedSave) {
      debouncedSave.cancel();
    }

    await saveWhiteboardState(canvasData);
  }

  /**
   * Setup history watcher for event-driven auto-save
   * @param historyStore - The history store to watch
   * @param getCanvasData - Function to get current canvas data
   * @returns Cleanup function to unsubscribe
   */
  function setupHistoryWatcher(
    historyStore: ReturnType<typeof useHistoryStore>,
    getCanvasData: () => object
  ): () => void {
    getCanvasDataFn = getCanvasData;

    // Create debounced save function
    debouncedSave = debounce(performAutoSave, autoSaveDebounceMs.value);

    // Subscribe to history store changes
    const unsubscribe = historyStore.$subscribe(() => {
      if (autoSave.value && debouncedSave) {
        debouncedSave();
      }
    });

    // Return cleanup function
    return () => {
      if (debouncedSave) {
        debouncedSave.cancel();
        debouncedSave = null;
      }
      getCanvasDataFn = null;
      unsubscribe();
    };
  }

  // Initialize settings asynchronously
  loadSettings();

  return {
    // State
    autoSave,
    autoSaveDebounceMs,
    lastSaved,
    isSaving,
    // Computed
    isEnabled,
    debounceMs,
    // Actions
    setAutoSave,
    setAutoSaveDebounce,
    saveWhiteboardState,
    loadWhiteboardState,
    deleteWhiteboardState,
    performAutoSaveImmediately,
    setupHistoryWatcher,
  };
});
