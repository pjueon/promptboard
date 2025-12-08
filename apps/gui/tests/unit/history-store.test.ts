import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useHistoryStore } from '../../src/renderer/stores/historyStore';

describe('History Store - Undo/Redo System', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('Snapshot Management', () => {
    it('should initialize with empty history', () => {
      const store = useHistoryStore();

      expect(store.canUndo).toBe(false);
      expect(store.canRedo).toBe(false);
    });

    it('should save snapshot and enable undo', () => {
      const store = useHistoryStore();

      store.saveSnapshot({ version: '1.0', objects: [] });

      expect(store.canUndo).toBe(false); // First snapshot is initial state

      store.saveSnapshot({ version: '1.0', objects: [{ type: 'rect' }] });

      expect(store.canUndo).toBe(true);
      expect(store.canRedo).toBe(false);
    });

    it('should save multiple snapshots', () => {
      const store = useHistoryStore();

      store.saveSnapshot({ version: '1.0', objects: [] });
      store.saveSnapshot({ version: '1.0', objects: [{ type: 'rect' }] });
      store.saveSnapshot({ version: '1.0', objects: [{ type: 'rect' }, { type: 'circle' }] });

      expect(store.canUndo).toBe(true);
    });
  });

  describe('Undo Operation', () => {
    it('should undo to previous snapshot', () => {
      const store = useHistoryStore();

      const snapshot1 = { version: '1.0', objects: [] };
      const snapshot2 = { version: '1.0', objects: [{ type: 'rect' }] };

      store.saveSnapshot(snapshot1);
      store.saveSnapshot(snapshot2);

      const result = store.undo();

      expect(result).toEqual(snapshot1);
      expect(store.canUndo).toBe(false);
      expect(store.canRedo).toBe(true);
    });

    it('should return null when no undo available', () => {
      const store = useHistoryStore();

      const result = store.undo();

      expect(result).toBeNull();
    });

    it('should undo multiple times', () => {
      const store = useHistoryStore();

      const snapshot1 = { version: '1.0', objects: [] };
      const snapshot2 = { version: '1.0', objects: [{ type: 'rect' }] };
      const snapshot3 = { version: '1.0', objects: [{ type: 'rect' }, { type: 'circle' }] };

      store.saveSnapshot(snapshot1);
      store.saveSnapshot(snapshot2);
      store.saveSnapshot(snapshot3);

      store.undo();
      const result = store.undo();

      expect(result).toEqual(snapshot1);
      expect(store.canUndo).toBe(false);
    });
  });

  describe('Redo Operation', () => {
    it('should redo to next snapshot', () => {
      const store = useHistoryStore();

      const snapshot1 = { version: '1.0', objects: [] };
      const snapshot2 = { version: '1.0', objects: [{ type: 'rect' }] };

      store.saveSnapshot(snapshot1);
      store.saveSnapshot(snapshot2);
      store.undo();

      const result = store.redo();

      expect(result).toEqual(snapshot2);
      expect(store.canUndo).toBe(true);
      expect(store.canRedo).toBe(false);
    });

    it('should return null when no redo available', () => {
      const store = useHistoryStore();

      store.saveSnapshot({ version: '1.0', objects: [] });

      const result = store.redo();

      expect(result).toBeNull();
    });

    it('should redo multiple times', () => {
      const store = useHistoryStore();

      const snapshot1 = { version: '1.0', objects: [] };
      const snapshot2 = { version: '1.0', objects: [{ type: 'rect' }] };
      const snapshot3 = { version: '1.0', objects: [{ type: 'rect' }, { type: 'circle' }] };

      store.saveSnapshot(snapshot1);
      store.saveSnapshot(snapshot2);
      store.saveSnapshot(snapshot3);

      store.undo();
      store.undo();

      store.redo();
      const result = store.redo();

      expect(result).toEqual(snapshot3);
      expect(store.canRedo).toBe(false);
    });
  });

  describe('History Branching', () => {
    it('should clear redo history when new snapshot is saved', () => {
      const store = useHistoryStore();

      store.saveSnapshot({ version: '1.0', objects: [] });
      store.saveSnapshot({ version: '1.0', objects: [{ type: 'rect' }] });
      store.saveSnapshot({ version: '1.0', objects: [{ type: 'rect' }, { type: 'circle' }] });

      store.undo();
      store.undo();

      expect(store.canRedo).toBe(true);

      store.saveSnapshot({ version: '1.0', objects: [{ type: 'line' }] });

      expect(store.canRedo).toBe(false);
    });
  });

  describe('History Limit', () => {
    it('should limit history to max size', () => {
      const store = useHistoryStore();

      // Save 52 snapshots (max is 50)
      for (let i = 1; i <= 52; i++) {
        store.saveSnapshot({ version: '1.0', objects: [], id: i });
      }

      // Should only keep last 50
      store.undo();
      const result = store.undo();

      // Should not be able to undo to snapshot1
      expect(result).toEqual({ version: '1.0', objects: [], id: 50 });
    });

    it('should maintain correct undo/redo after trimming', () => {
      const store = useHistoryStore();

      for (let i = 1; i <= 55; i++) {
        store.saveSnapshot({ version: '1.0', objects: [], id: i });
      }

      expect(store.canUndo).toBe(true);

      const undoResult = store.undo();
      expect(undoResult).toEqual({ version: '1.0', objects: [], id: 54 });

      const redoResult = store.redo();
      expect(redoResult).toEqual({ version: '1.0', objects: [], id: 55 });
    });
  });

  describe('Clear History', () => {
    it('should clear all history', () => {
      const store = useHistoryStore();

      store.saveSnapshot({ version: '1.0', objects: [] });
      store.saveSnapshot({ version: '1.0', objects: [{ type: 'rect' }] });

      store.clearHistory();

      expect(store.canUndo).toBe(false);
      expect(store.canRedo).toBe(false);
    });
  });
});
