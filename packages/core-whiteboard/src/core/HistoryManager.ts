import type { CanvasManager } from './CanvasManager';
import type { CanvasState } from '../types';

/**
 * History configuration options
 */
export interface HistoryManagerConfig {
  maxHistory?: number;
  propertiesToInclude?: string[];
}

/**
 * Event types for history changes
 */
export type HistoryEventType = 'change' | 'snapshot' | 'undo' | 'redo' | 'clear';

/**
 * History event payload
 */
export interface HistoryEvent {
  type: HistoryEventType;
  canUndo: boolean;
  canRedo: boolean;
  currentIndex: number;
  snapshotCount: number;
}

/**
 * Manages canvas history (undo/redo functionality)
 * Framework-independent, works with CanvasManager
 */
export class HistoryManager {
  private canvasManager: CanvasManager;
  private snapshots: CanvasState[] = [];
  private currentIndex: number = -1;
  private maxHistory: number;
  private propertiesToInclude: string[];
  private listeners: Map<HistoryEventType, Set<(event: HistoryEvent) => void>>;
  private isRestoring: boolean = false;

  constructor(canvasManager: CanvasManager, config?: HistoryManagerConfig) {
    this.canvasManager = canvasManager;
    this.maxHistory = config?.maxHistory ?? 50;
    this.propertiesToInclude = config?.propertiesToInclude ?? [];
    this.listeners = new Map();
  }

  /**
   * Get current position in history
   */
  getCurrentIndex(): number {
    return this.currentIndex;
  }

  /**
   * Get total number of snapshots
   */
  getSnapshotCount(): number {
    return this.snapshots.length;
  }

  /**
   * Check if undo is possible
   */
  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  /**
   * Check if redo is possible
   */
  canRedo(): boolean {
    return this.currentIndex < this.snapshots.length - 1;
  }

  /**
   * Check if currently restoring a snapshot
   */
  isRestoringSnapshot(): boolean {
    return this.isRestoring;
  }

  /**
   * Save current canvas state as a snapshot
   */
  saveSnapshot(): void {
    // Remove all snapshots after current index (branch prevention)
    this.snapshots = this.snapshots.slice(0, this.currentIndex + 1);

    // Get current canvas state
    const canvasState = this.canvasManager.toJSON(
      this.propertiesToInclude.length > 0 ? this.propertiesToInclude : undefined
    );

    // Add new snapshot
    this.snapshots.push(canvasState);
    this.currentIndex++;

    // Trim old snapshots if exceeding max
    if (this.snapshots.length > this.maxHistory) {
      this.snapshots.shift();
      this.currentIndex--;
    }

    // Emit events
    this.emit('snapshot');
  }

  /**
   * Undo to previous snapshot
   */
  undo(): boolean {
    if (this.currentIndex <= 0) {
      return false;
    }

    this.currentIndex--;
    const snapshot = this.snapshots[this.currentIndex];

    // Restore snapshot
    this.isRestoring = true;
    this.canvasManager.loadFromJSON(snapshot, () => {
      this.isRestoring = false;
      // Emit events after restoration is complete
      this.emit('undo');
    });

    return true;
  }

  /**
   * Redo to next snapshot
   */
  redo(): boolean {
    if (this.currentIndex >= this.snapshots.length - 1) {
      return false;
    }

    this.currentIndex++;
    const snapshot = this.snapshots[this.currentIndex];

    // Restore snapshot
    this.isRestoring = true;
    this.canvasManager.loadFromJSON(snapshot, () => {
      this.isRestoring = false;
      // Emit events after restoration is complete
      this.emit('redo');
    });

    return true;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.snapshots = [];
    this.currentIndex = -1;

    // Emit events
    this.emit('clear');
  }

  /**
   * Subscribe to history events
   */
  on(eventType: HistoryEventType, listener: (event: HistoryEvent) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    // Return unsubscribe function
    return () => this.off(eventType, listener);
  }

  /**
   * Remove event listener
   */
  off(eventType: HistoryEventType, listener: (event: HistoryEvent) => void): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Emit an event to all registered listeners
   */
  private emit(eventType: HistoryEventType): void {
    const event: HistoryEvent = {
      type: eventType,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      currentIndex: this.currentIndex,
      snapshotCount: this.snapshots.length
    };

    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }

    // Always emit 'change' event except when it's already 'change'
    if (eventType !== 'change') {
      const changeListeners = this.listeners.get('change');
      if (changeListeners) {
        const changeEvent: HistoryEvent = { ...event, type: 'change' };
        changeListeners.forEach(listener => listener(changeEvent));
      }
    }
  }

  /**
   * Update max history limit
   */
  setMaxHistory(max: number): void {
    this.maxHistory = max;

    // Trim snapshots if current count exceeds new limit
    while (this.snapshots.length > this.maxHistory) {
      this.snapshots.shift();
      this.currentIndex--;
    }
  }

  /**
   * Get max history limit
   */
  getMaxHistory(): number {
    return this.maxHistory;
  }

  /**
   * Set which Fabric properties to include in snapshots
   */
  setPropertiesToInclude(properties: string[]): void {
    this.propertiesToInclude = properties;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.listeners.clear();
    this.snapshots = [];
    this.currentIndex = -1;
  }
}
