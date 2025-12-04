import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import WhiteboardCanvas from '../../src/renderer/components/WhiteboardCanvas.vue';
import { useToolbarStore } from '../../src/renderer/stores/toolbarStore';

describe('Eraser Tool', () => {
  let wrapper: VueWrapper;
  let toolbarStore: ReturnType<typeof useToolbarStore>;

  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    toolbarStore = useToolbarStore();

    wrapper = mount(WhiteboardCanvas, {
      global: {
        plugins: [pinia],
      },
      attachTo: document.body,
    });
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe('Tool Selection', () => {
    it('should allow switching to eraser tool', () => {
      toolbarStore.setTool('eraser');
      expect(toolbarStore.currentTool).toBe('eraser');
    });

    it('should switch back to pen tool from eraser', () => {
      toolbarStore.setTool('eraser');
      expect(toolbarStore.currentTool).toBe('eraser');
      
      toolbarStore.setTool('pen');
      expect(toolbarStore.currentTool).toBe('pen');
    });

    it('should switch to select tool from eraser', () => {
      toolbarStore.setTool('eraser');
      expect(toolbarStore.currentTool).toBe('eraser');
      
      toolbarStore.setTool('select');
      expect(toolbarStore.currentTool).toBe('select');
    });
  });

  describe('Stroke Width', () => {
    it('should use toolbar strokeWidth setting for eraser', () => {
      const testWidth = 15;
      toolbarStore.setStrokeWidth(testWidth);
      toolbarStore.setTool('eraser');
      
      expect(toolbarStore.strokeWidth).toBe(testWidth);
    });

    it('should update strokeWidth while eraser is active', () => {
      toolbarStore.setTool('eraser');
      
      const newWidth = 25;
      toolbarStore.setStrokeWidth(newWidth);
      
      expect(toolbarStore.strokeWidth).toBe(newWidth);
    });
  });

  describe('Component Rendering', () => {
    it('should render canvas element', () => {
      const canvas = wrapper.find('#whiteboard-canvas');
      expect(canvas.exists()).toBe(true);
    });

    it('should mount and unmount without errors', async () => {
      toolbarStore.setTool('eraser');
      await wrapper.vm.$nextTick();
      
      expect(() => wrapper.unmount()).not.toThrow();
    });
  });
});
