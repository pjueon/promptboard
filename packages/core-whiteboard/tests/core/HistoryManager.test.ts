import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HistoryManager } from '../../src/core/HistoryManager';
import type { CanvasManager } from '../../src/core/CanvasManager';
import type { CanvasState } from '../../src/types';

/**
 * Mock CanvasManager for testing
 * Simulates canvas state management without actual Fabric.js
 */
const createMockCanvasManager = () => {
  let currentState: CanvasState = { version: '1.0', objects: [] };

  return {
    toJSON: vi.fn((properties?: string[]) => ({ ...currentState })),
    loadFromJSON: vi.fn((state: CanvasState, callback?: () => void) => {
      currentState = { ...state };
      callback?.();
    })
  } as unknown as CanvasManager;
};

describe('HistoryManager', () => {
  let canvasManager: CanvasManager;
  let historyManager: HistoryManager;

  beforeEach(() => {
    canvasManager = createMockCanvasManager();
    historyManager = new HistoryManager(canvasManager);
  });

  describe('initialization', () => {
    it('should start with empty history', () => {
      expect(historyManager.getCurrentIndex()).toBe(-1);
      expect(historyManager.getSnapshotCount()).toBe(0);
      expect(historyManager.canUndo()).toBe(false);
      expect(historyManager.canRedo()).toBe(false);
    });
  });

  describe('saveSnapshot', () => {
    it('should save first snapshot', () => {
      historyManager.saveSnapshot();

      expect(historyManager.getCurrentIndex()).toBe(0);
      expect(historyManager.getSnapshotCount()).toBe(1);
      expect(historyManager.canUndo()).toBe(false); // Can't undo from first snapshot
      expect(historyManager.canRedo()).toBe(false);
    });

    it('should save multiple snapshots', () => {
      historyManager.saveSnapshot(); // index 0
      historyManager.saveSnapshot(); // index 1
      historyManager.saveSnapshot(); // index 2

      expect(historyManager.getCurrentIndex()).toBe(2);
      expect(historyManager.getSnapshotCount()).toBe(3);
      expect(historyManager.canUndo()).toBe(true);
      expect(historyManager.canRedo()).toBe(false);
    });
  });

  describe('undo', () => {
    it('should undo to previous snapshot', () => {
      historyManager.saveSnapshot();
      historyManager.saveSnapshot();

      const result = historyManager.undo();

      expect(result).toBe(true);
      expect(historyManager.getCurrentIndex()).toBe(0);
      expect(historyManager.canUndo()).toBe(false);
      expect(historyManager.canRedo()).toBe(true);
      expect(canvasManager.loadFromJSON).toHaveBeenCalled();
    });

    it('should return false when undo at beginning', () => {
      historyManager.saveSnapshot();

      const result = historyManager.undo();

      expect(result).toBe(false);
      expect(historyManager.getCurrentIndex()).toBe(0);
    });
  });

  describe('redo', () => {
    it('should redo to next snapshot', () => {
      historyManager.saveSnapshot();
      historyManager.saveSnapshot();
      historyManager.undo();

      const result = historyManager.redo();

      expect(result).toBe(true);
      expect(historyManager.getCurrentIndex()).toBe(1);
      expect(historyManager.canUndo()).toBe(true);
      expect(historyManager.canRedo()).toBe(false);
      expect(canvasManager.loadFromJSON).toHaveBeenCalled();
    });

    it('should return false when redo at end', () => {
      historyManager.saveSnapshot();

      const result = historyManager.redo();

      expect(result).toBe(false);
      expect(historyManager.getCurrentIndex()).toBe(0);
    });
  });

  describe('branch prevention', () => {
    it('should clear redo history when saving in the middle', () => {
      historyManager.saveSnapshot(); // 0
      historyManager.saveSnapshot(); // 1
      historyManager.saveSnapshot(); // 2
      historyManager.undo(); // back to 1
      historyManager.undo(); // back to 0

      historyManager.saveSnapshot(); // new snapshot at 1

      expect(historyManager.getCurrentIndex()).toBe(1);
      expect(historyManager.getSnapshotCount()).toBe(2); // 0, 1 (2 is deleted)
      expect(historyManager.canRedo()).toBe(false);
    });
  });

  describe('maxHistory', () => {
    it('should limit snapshots to maxHistory', () => {
      const limitedHistory = new HistoryManager(canvasManager, { maxHistory: 3 });

      limitedHistory.saveSnapshot(); // 0
      limitedHistory.saveSnapshot(); // 1
      limitedHistory.saveSnapshot(); // 2
      limitedHistory.saveSnapshot(); // 3 (0 deleted)

      expect(limitedHistory.getSnapshotCount()).toBe(3);
      expect(limitedHistory.getCurrentIndex()).toBe(2); // last of 3
    });
  });

  describe('clear', () => {
    it('should clear all history', () => {
      historyManager.saveSnapshot();
      historyManager.saveSnapshot();

      historyManager.clear();

      expect(historyManager.getCurrentIndex()).toBe(-1);
      expect(historyManager.getSnapshotCount()).toBe(0);
      expect(historyManager.canUndo()).toBe(false);
      expect(historyManager.canRedo()).toBe(false);
    });
  });

  describe('events', () => {
    it('should emit change and snapshot events on saveSnapshot', () => {
      const changeListener = vi.fn();
      const snapshotListener = vi.fn();

      historyManager.on('change', changeListener);
      historyManager.on('snapshot', snapshotListener);
      historyManager.saveSnapshot();

      expect(changeListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'change',
          canUndo: false,
          canRedo: false,
          currentIndex: 0,
          snapshotCount: 1
        })
      );
      expect(snapshotListener).toHaveBeenCalled();
    });

    it('should emit change and undo events on undo', () => {
      const changeListener = vi.fn();
      const undoListener = vi.fn();

      historyManager.saveSnapshot();
      historyManager.saveSnapshot();

      changeListener.mockClear(); // Clear previous calls

      historyManager.on('change', changeListener);
      historyManager.on('undo', undoListener);
      historyManager.undo();

      expect(changeListener).toHaveBeenCalled();
      expect(undoListener).toHaveBeenCalled();
    });

    it('should remove event listener with off()', () => {
      const listener = vi.fn();

      historyManager.on('change', listener);
      historyManager.off('change', listener);
      historyManager.saveSnapshot();

      expect(listener).not.toHaveBeenCalled();
    });

    it('should unsubscribe with returned function', () => {
      const listener = vi.fn();

      const unsubscribe = historyManager.on('change', listener);
      unsubscribe();
      historyManager.saveSnapshot();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('isRestoring flag', () => {
    it('should set isRestoring flag during restoration', () => {
      expect(historyManager.isRestoringSnapshot()).toBe(false);

      historyManager.saveSnapshot();
      historyManager.saveSnapshot();

      // Mock loadFromJSON to check flag during callback
      let isRestoringDuringCallback = false;
      canvasManager.loadFromJSON = vi.fn((state, callback) => {
        isRestoringDuringCallback = historyManager.isRestoringSnapshot();
        callback?.();
      }) as any;

      historyManager.undo();

      expect(isRestoringDuringCallback).toBe(true);
      expect(historyManager.isRestoringSnapshot()).toBe(false); // After restoration
    });
  });

  describe('setMaxHistory', () => {
    it('should update maxHistory and trim snapshots', () => {
      const manager = new HistoryManager(canvasManager, { maxHistory: 10 });

      for (let i = 0; i < 5; i++) {
        manager.saveSnapshot();
      }

      expect(manager.getSnapshotCount()).toBe(5);

      manager.setMaxHistory(3);

      expect(manager.getMaxHistory()).toBe(3);
      expect(manager.getSnapshotCount()).toBe(3); // Oldest 2 deleted
      expect(manager.getCurrentIndex()).toBe(2); // Last position adjusted
    });
  });

  describe('propertiesToInclude', () => {
    it('should pass propertiesToInclude to toJSON', () => {
      const manager = new HistoryManager(canvasManager, {
        propertiesToInclude: ['arrowId', 'selectable']
      });

      manager.saveSnapshot();

      expect(canvasManager.toJSON).toHaveBeenCalledWith(['arrowId', 'selectable']);
    });
  });
});
