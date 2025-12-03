import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useToolbarStore } from '../../src/renderer/stores/toolbarStore';

describe('Toolbar Store', () => {
  beforeEach(() => {
    // Create a fresh pinia instance for each test
    setActivePinia(createPinia());
  });

  describe('Initial State', () => {
    it('should have pen as default tool', () => {
      const store = useToolbarStore();
      expect(store.currentTool).toBe('pen');
    });

    it('should have black as default color', () => {
      const store = useToolbarStore();
      expect(store.color).toBe('#000000');
    });

    it('should have 2 as default stroke width', () => {
      const store = useToolbarStore();
      expect(store.strokeWidth).toBe(2);
    });
  });

  describe('Tool Selection', () => {
    it('should change to select tool', () => {
      const store = useToolbarStore();
      store.setTool('select');
      expect(store.currentTool).toBe('select');
    });

    it('should change to line tool', () => {
      const store = useToolbarStore();
      store.setTool('line');
      expect(store.currentTool).toBe('line');
    });

    it('should change to rectangle tool', () => {
      const store = useToolbarStore();
      store.setTool('rectangle');
      expect(store.currentTool).toBe('rectangle');
    });

    it('should change to eraser tool', () => {
      const store = useToolbarStore();
      store.setTool('eraser');
      expect(store.currentTool).toBe('eraser');
    });

    it('should change to circle tool', () => {
      const store = useToolbarStore();
      store.setTool('circle');
      expect(store.currentTool).toBe('circle');
    });

    it('should change to text tool', () => {
      const store = useToolbarStore();
      store.setTool('text');
      expect(store.currentTool).toBe('text');
    });

    it('should return back to pen tool', () => {
      const store = useToolbarStore();
      store.setTool('circle');
      store.setTool('pen');
      expect(store.currentTool).toBe('pen');
    });
  });

  describe('Color Selection', () => {
    it('should change color to red', () => {
      const store = useToolbarStore();
      store.setColor('#ff0000');
      expect(store.color).toBe('#ff0000');
    });

    it('should change color to blue', () => {
      const store = useToolbarStore();
      store.setColor('#0000ff');
      expect(store.color).toBe('#0000ff');
    });

    it('should change color to custom hex value', () => {
      const store = useToolbarStore();
      store.setColor('#a3c5e8');
      expect(store.color).toBe('#a3c5e8');
    });
  });

  describe('Stroke Width Selection', () => {
    it('should change stroke width to 1', () => {
      const store = useToolbarStore();
      store.setStrokeWidth(1);
      expect(store.strokeWidth).toBe(1);
    });

    it('should change stroke width to 5', () => {
      const store = useToolbarStore();
      store.setStrokeWidth(5);
      expect(store.strokeWidth).toBe(5);
    });

    it('should change stroke width to 10', () => {
      const store = useToolbarStore();
      store.setStrokeWidth(10);
      expect(store.strokeWidth).toBe(10);
    });
  });

  describe('Font Size', () => {
    it('should have 20 as default font size', () => {
      const store = useToolbarStore();
      expect(store.fontSize).toBe(20);
    });

    it('should change font size to 12', () => {
      const store = useToolbarStore();
      store.setFontSize(12);
      expect(store.fontSize).toBe(12);
    });

    it('should change font size to 48', () => {
      const store = useToolbarStore();
      store.setFontSize(48);
      expect(store.fontSize).toBe(48);
    });
  });

  describe('Multiple State Changes', () => {
    it('should maintain state across multiple tool changes', () => {
      const store = useToolbarStore();
      store.setTool('line');
      store.setColor('#ff0000');
      store.setStrokeWidth(5);

      expect(store.currentTool).toBe('line');
      expect(store.color).toBe('#ff0000');
      expect(store.strokeWidth).toBe(5);
    });

    it('should preserve color and stroke width when changing tools', () => {
      const store = useToolbarStore();
      store.setColor('#00ff00');
      store.setStrokeWidth(8);
      store.setTool('rectangle');

      expect(store.color).toBe('#00ff00');
      expect(store.strokeWidth).toBe(8);
      expect(store.currentTool).toBe('rectangle');
    });
  });
});
