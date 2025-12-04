import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import WhiteboardCanvas from '../../src/renderer/components/WhiteboardCanvas.vue';
import { useToolbarStore } from '../../src/renderer/stores/toolbarStore';

describe('WhiteboardCanvas - Toolbar Integration', () => {
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
    it('should switch between different tools', async () => {
      const tools = ['pen', 'select', 'eraser', 'line', 'rectangle', 'circle', 'text'] as const;
      
      for (const tool of tools) {
        toolbarStore.setTool(tool);
        await wrapper.vm.$nextTick();
        expect(toolbarStore.currentTool).toBe(tool);
      }
    });

    it('should maintain tool selection across updates', async () => {
      toolbarStore.setTool('rectangle');
      await wrapper.vm.$nextTick();
      
      // Trigger some other updates
      toolbarStore.setColor('#ff0000');
      await wrapper.vm.$nextTick();
      
      expect(toolbarStore.currentTool).toBe('rectangle');
    });
  });

  describe('Color Changes', () => {
    it('should update color in store', async () => {
      const newColor = '#ff5500';
      toolbarStore.setColor(newColor);
      await wrapper.vm.$nextTick();
      
      expect(toolbarStore.color).toBe(newColor);
    });

    it('should handle multiple color changes', async () => {
      const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
      
      for (const color of colors) {
        toolbarStore.setColor(color);
        await wrapper.vm.$nextTick();
        expect(toolbarStore.color).toBe(color);
      }
    });
  });

  describe('Stroke Width', () => {
    it('should update stroke width', async () => {
      const widths = [1, 5, 10, 20, 30];
      
      for (const width of widths) {
        toolbarStore.setStrokeWidth(width);
        await wrapper.vm.$nextTick();
        expect(toolbarStore.strokeWidth).toBe(width);
      }
    });
  });

  describe('Component Lifecycle', () => {
    it('should render canvas element', () => {
      const canvas = wrapper.find('#whiteboard-canvas');
      expect(canvas.exists()).toBe(true);
      expect(canvas.element.tagName).toBe('CANVAS');
    });

    it('should mount and unmount without errors', async () => {
      // Change some states
      toolbarStore.setTool('line');
      toolbarStore.setColor('#123456');
      toolbarStore.setStrokeWidth(15);
      await wrapper.vm.$nextTick();
      
      expect(() => wrapper.unmount()).not.toThrow();
    });

    it('should handle rapid tool switches', async () => {
      const tools = ['pen', 'select', 'line', 'pen', 'eraser', 'pen'] as const;
      
      for (const tool of tools) {
        toolbarStore.setTool(tool);
        // Don't await - simulate rapid changes
      }
      
      await wrapper.vm.$nextTick();
      expect(toolbarStore.currentTool).toBe('pen');
    });
  });
});
