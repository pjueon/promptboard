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
      
      store.saveSnapshot('data:image/png;base64,snapshot1');
      
      expect(store.canUndo).toBe(false); // First snapshot is initial state
      
      store.saveSnapshot('data:image/png;base64,snapshot2');
      
      expect(store.canUndo).toBe(true);
      expect(store.canRedo).toBe(false);
    });

    it('should save multiple snapshots', () => {
      const store = useHistoryStore();
      
      store.saveSnapshot('data:image/png;base64,snapshot1');
      store.saveSnapshot('data:image/png;base64,snapshot2');
      store.saveSnapshot('data:image/png;base64,snapshot3');
      
      expect(store.canUndo).toBe(true);
    });
  });

  describe('Undo Operation', () => {
    it('should undo to previous snapshot', () => {
      const store = useHistoryStore();
      
      store.saveSnapshot('data:image/png;base64,snapshot1');
      store.saveSnapshot('data:image/png;base64,snapshot2');
      
      const result = store.undo();
      
      expect(result).toBe('data:image/png;base64,snapshot1');
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
      
      store.saveSnapshot('data:image/png;base64,snapshot1');
      store.saveSnapshot('data:image/png;base64,snapshot2');
      store.saveSnapshot('data:image/png;base64,snapshot3');
      
      store.undo();
      const result = store.undo();
      
      expect(result).toBe('data:image/png;base64,snapshot1');
      expect(store.canUndo).toBe(false);
    });
  });

  describe('Redo Operation', () => {
    it('should redo to next snapshot', () => {
      const store = useHistoryStore();
      
      store.saveSnapshot('data:image/png;base64,snapshot1');
      store.saveSnapshot('data:image/png;base64,snapshot2');
      store.undo();
      
      const result = store.redo();
      
      expect(result).toBe('data:image/png;base64,snapshot2');
      expect(store.canUndo).toBe(true);
      expect(store.canRedo).toBe(false);
    });

    it('should return null when no redo available', () => {
      const store = useHistoryStore();
      
      store.saveSnapshot('data:image/png;base64,snapshot1');
      
      const result = store.redo();
      
      expect(result).toBeNull();
    });

    it('should redo multiple times', () => {
      const store = useHistoryStore();
      
      store.saveSnapshot('data:image/png;base64,snapshot1');
      store.saveSnapshot('data:image/png;base64,snapshot2');
      store.saveSnapshot('data:image/png;base64,snapshot3');
      
      store.undo();
      store.undo();
      
      store.redo();
      const result = store.redo();
      
      expect(result).toBe('data:image/png;base64,snapshot3');
      expect(store.canRedo).toBe(false);
    });
  });

  describe('History Branching', () => {
    it('should clear redo history when new snapshot is saved', () => {
      const store = useHistoryStore();
      
      store.saveSnapshot('data:image/png;base64,snapshot1');
      store.saveSnapshot('data:image/png;base64,snapshot2');
      store.saveSnapshot('data:image/png;base64,snapshot3');
      
      store.undo();
      store.undo();
      
      expect(store.canRedo).toBe(true);
      
      store.saveSnapshot('data:image/png;base64,snapshot4');
      
      expect(store.canRedo).toBe(false);
    });
  });

  describe('History Limit', () => {
    it('should limit history to max size', () => {
      const store = useHistoryStore();
      
      // Save 52 snapshots (max is 50)
      for (let i = 1; i <= 52; i++) {
        store.saveSnapshot(`data:image/png;base64,snapshot${i}`);
      }
      
      // Should only keep last 50
      store.undo();
      const result = store.undo();
      
      // Should not be able to undo to snapshot1
      expect(result).toBe('data:image/png;base64,snapshot50');
    });

    it('should maintain correct undo/redo after trimming', () => {
      const store = useHistoryStore();
      
      for (let i = 1; i <= 55; i++) {
        store.saveSnapshot(`data:image/png;base64,snapshot${i}`);
      }
      
      expect(store.canUndo).toBe(true);
      
      const undoResult = store.undo();
      expect(undoResult).toBe('data:image/png;base64,snapshot54');
      
      const redoResult = store.redo();
      expect(redoResult).toBe('data:image/png;base64,snapshot55');
    });
  });

  describe('Clear History', () => {
    it('should clear all history', () => {
      const store = useHistoryStore();
      
      store.saveSnapshot('data:image/png;base64,snapshot1');
      store.saveSnapshot('data:image/png;base64,snapshot2');
      
      store.clearHistory();
      
      expect(store.canUndo).toBe(false);
      expect(store.canRedo).toBe(false);
    });
  });
});
