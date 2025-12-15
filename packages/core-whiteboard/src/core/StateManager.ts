import type { CanvasManager } from './CanvasManager';
import type { HistoryManager } from './HistoryManager';
import type { CanvasState } from '../types';
import { debounce, type DebouncedFunction } from '../utils/debounce';

export interface StorageAdapter {
  save(data: CanvasState): Promise<void>;
  load(): Promise<CanvasState | null>;
  delete(): Promise<void>;
}

export interface StateManagerConfig {
  autoSave?: boolean;
  debounceMs?: number;
  propertiesToInclude?: string[];
  storageAdapter?: StorageAdapter;
}

export class StateManager {
  private canvasManager: CanvasManager;
  private historyManager: HistoryManager;
  private storageAdapter?: StorageAdapter;
  private config: Required<Omit<StateManagerConfig, 'storageAdapter'>>;
  private debouncedSave: DebouncedFunction<() => Promise<void>> | null = null;
  private cleanupHistoryListener: (() => void) | null = null;

  constructor(
    canvasManager: CanvasManager,
    historyManager: HistoryManager,
    config: StateManagerConfig = {}
  ) {
    this.canvasManager = canvasManager;
    this.historyManager = historyManager;
    this.storageAdapter = config.storageAdapter;
    this.config = {
      autoSave: config.autoSave ?? true,
      debounceMs: config.debounceMs ?? 1000,
      propertiesToInclude: config.propertiesToInclude ?? [],
    };

    this.setupAutoSave();
  }

  /**
   * Setup auto-save listener
   */
  private setupAutoSave(): void {
    // Cleanup previous listener if any
    if (this.cleanupHistoryListener) {
      this.cleanupHistoryListener();
      this.cleanupHistoryListener = null;
    }

    // Cancel previous debounce if any
    if (this.debouncedSave) {
      this.debouncedSave.cancel();
      this.debouncedSave = null;
    }

    if (this.config.autoSave && this.storageAdapter) {
      // Create debounced save function
      this.debouncedSave = debounce(
        async () => {
          await this.save();
        },
        this.config.debounceMs
      );

      // Listen to history changes
      // We listen to 'change', 'undo', 'redo', 'clear' events implicitly via 'change' event in HistoryManager
      // But HistoryManager emits 'change' for all operations, so we just need to listen to that.
      this.cleanupHistoryListener = this.historyManager.on('change', () => {
        if (this.debouncedSave) {
          this.debouncedSave();
        }
      });
    }
  }

  /**
   * Manually save the current state
   */
  async save(): Promise<void> {
    if (!this.storageAdapter) {
      console.warn('No storage adapter configured for StateManager');
      return;
    }

    const state = this.canvasManager.toJSON(this.config.propertiesToInclude);
    await this.storageAdapter.save(state);
  }

  /**
   * Load state from storage
   */
  async load(): Promise<CanvasState | null> {
    if (!this.storageAdapter) {
      console.warn('No storage adapter configured for StateManager');
      return null;
    }

    const state = await this.storageAdapter.load();
    if (state) {
      return new Promise((resolve) => {
        this.canvasManager.loadFromJSON(state, () => {
          resolve(state);
        });
      });
    }

    return null;
  }

  /**
   * Enable or disable auto-save
   */
  setAutoSave(enabled: boolean): void {
    this.config.autoSave = enabled;
    this.setupAutoSave();
  }

  /**
   * Set debounce time in milliseconds
   */
  setDebounceMs(ms: number): void {
    this.config.debounceMs = ms;
    this.setupAutoSave();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.cleanupHistoryListener) {
      this.cleanupHistoryListener();
      this.cleanupHistoryListener = null;
    }
    if (this.debouncedSave) {
      this.debouncedSave.cancel();
      this.debouncedSave = null;
    }
  }
}
