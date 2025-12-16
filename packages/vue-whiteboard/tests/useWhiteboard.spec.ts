import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref, nextTick } from 'vue';
import { useWhiteboard } from '../src/composables/useWhiteboard';

describe('useWhiteboard', () => {
  let canvasElement: HTMLCanvasElement;

  beforeEach(() => {
    // Create a mock canvas element
    canvasElement = document.createElement('canvas');
    canvasElement.width = 800;
    canvasElement.height = 600;
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { isReady, currentTool } = useWhiteboard();

      expect(isReady.value).toBe(false);
      expect(currentTool.value).toBe(null);
    });

    it('should initialize canvas when canvas element ref is set', async () => {
      const { canvasRef, isReady, initialize } = useWhiteboard();

      canvasRef.value = canvasElement;
      await initialize({ width: 800, height: 600 });

      expect(isReady.value).toBe(true);
    });

    it('should throw error if initialized without canvas element', async () => {
      const { initialize } = useWhiteboard();

      await expect(initialize({ width: 800, height: 600 })).rejects.toThrow(
        'Canvas element is required'
      );
    });
  });

  describe('tool management', () => {
    it('should switch tools', async () => {
      const { canvasRef, initialize, setTool, currentTool } = useWhiteboard();

      canvasRef.value = canvasElement;
      await initialize({ width: 800, height: 600 });

      setTool('pen');
      await nextTick();

      expect(currentTool.value).toBe('pen');
    });

    it('should provide tool options', async () => {
      const { canvasRef, initialize, setToolOptions, getToolOptions } = useWhiteboard();

      canvasRef.value = canvasElement;
      await initialize({ width: 800, height: 600 });

      setToolOptions({ stroke: '#ff0000', strokeWidth: 5 });
      const options = getToolOptions();

      expect(options.stroke).toBe('#ff0000');
      expect(options.strokeWidth).toBe(5);
    });
  });

  describe('history management', () => {
    it('should track undo/redo availability', async () => {
      const { canvasRef, initialize, canUndo, canRedo } = useWhiteboard();

      canvasRef.value = canvasElement;
      await initialize({ width: 800, height: 600 });

      expect(canUndo.value).toBe(false);
      expect(canRedo.value).toBe(false);
    });

    it('should support undo operation', async () => {
      const { canvasRef, initialize, undo, canUndo } = useWhiteboard();

      canvasRef.value = canvasElement;
      await initialize({ width: 800, height: 600 });

      // Mock history state
      canUndo.value = true;

      expect(() => undo()).not.toThrow();
    });

    it('should support redo operation', async () => {
      const { canvasRef, initialize, redo, canRedo } = useWhiteboard();

      canvasRef.value = canvasElement;
      await initialize({ width: 800, height: 600 });

      // Mock history state
      canRedo.value = true;

      expect(() => redo()).not.toThrow();
    });
  });

  describe('state management', () => {
    it('should save canvas state', async () => {
      const { canvasRef, initialize, saveState } = useWhiteboard();

      canvasRef.value = canvasElement;
      await initialize({ width: 800, height: 600 });

      const state = await saveState();

      expect(state).toBeDefined();
      expect(typeof state).toBe('string');
    });

    it('should load canvas state', async () => {
      const { canvasRef, initialize, saveState, loadState } = useWhiteboard();

      canvasRef.value = canvasElement;
      await initialize({ width: 800, height: 600 });

      const state = await saveState();
      await loadState(state);

      // Should not throw
      expect(true).toBe(true);
    });

    it('should clear canvas', async () => {
      const { canvasRef, initialize, clear } = useWhiteboard();

      canvasRef.value = canvasElement;
      await initialize({ width: 800, height: 600 });

      expect(() => clear()).not.toThrow();
    });
  });

  describe('canvas access', () => {
    it('should provide access to underlying canvas', async () => {
      const { canvasRef, initialize, getCanvas } = useWhiteboard();

      canvasRef.value = canvasElement;
      await initialize({ width: 800, height: 600 });

      const canvas = getCanvas();

      expect(canvas).toBeDefined();
      expect(canvas).toHaveProperty('add');
      expect(canvas).toHaveProperty('renderAll');
    });

    it('should return null if canvas not initialized', () => {
      const { getCanvas } = useWhiteboard();

      const canvas = getCanvas();

      expect(canvas).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('should provide cleanup function', async () => {
      const { canvasRef, initialize, cleanup } = useWhiteboard();

      canvasRef.value = canvasElement;
      await initialize({ width: 800, height: 600 });

      expect(() => cleanup()).not.toThrow();
    });

    it('should reset state after cleanup', async () => {
      const { canvasRef, initialize, cleanup, isReady } = useWhiteboard();

      canvasRef.value = canvasElement;
      await initialize({ width: 800, height: 600 });

      cleanup();

      expect(isReady.value).toBe(false);
    });
  });

  describe('resize', () => {
    it('should support canvas resize', async () => {
      const { canvasRef, initialize, resize } = useWhiteboard();

      canvasRef.value = canvasElement;
      await initialize({ width: 800, height: 600 });

      expect(() => resize(1024, 768)).not.toThrow();
    });
  });

  describe('event handling', () => {
    it('should emit events on tool change', async () => {
      const { canvasRef, initialize, setTool, onToolChange } = useWhiteboard();

      canvasRef.value = canvasElement;
      await initialize({ width: 800, height: 600 });

      const handler = vi.fn();
      onToolChange(handler);

      setTool('pen');
      await nextTick();

      expect(handler).toHaveBeenCalledWith('pen');
    });

    it('should emit events on history change', async () => {
      const { canvasRef, initialize, onHistoryChange, getCanvas } = useWhiteboard();

      canvasRef.value = canvasElement;
      await initialize({ width: 800, height: 600 });

      const handler = vi.fn();
      onHistoryChange(handler);

      // Trigger a history change by adding an object to the canvas
      const canvas = getCanvas();
      if (canvas) {
        const rect = new (window as any).fabric.Rect({
          left: 100,
          top: 100,
          width: 50,
          height: 50,
          fill: 'red',
        });
        canvas.add(rect);
        canvas.renderAll();

        // Wait for the history manager to process the change
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Should emit event when history changes
      expect(handler).toHaveBeenCalled();
    });
  });
});
