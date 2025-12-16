import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import WhiteboardCanvas from '../src/components/WhiteboardCanvas.vue';

describe('WhiteboardCanvas', () => {
  describe('rendering', () => {
    it('should render a canvas element', () => {
      const wrapper = mount(WhiteboardCanvas, {
        props: {
          width: 800,
          height: 600,
        },
      });

      const canvas = wrapper.find('canvas');
      expect(canvas.exists()).toBe(true);
    });

    it('should apply correct dimensions', () => {
      const wrapper = mount(WhiteboardCanvas, {
        props: {
          width: 1024,
          height: 768,
        },
      });

      const canvas = wrapper.find('canvas').element as HTMLCanvasElement;
      expect(canvas.width).toBe(1024);
      expect(canvas.height).toBe(768);
    });

    it('should render with default props', () => {
      const wrapper = mount(WhiteboardCanvas);

      const canvas = wrapper.find('canvas');
      expect(canvas.exists()).toBe(true);
    });
  });

  describe('initialization', () => {
    it('should initialize whiteboard on mount', async () => {
      const wrapper = mount(WhiteboardCanvas, {
        props: {
          width: 800,
          height: 600,
        },
      });

      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should be initialized
      expect(wrapper.vm.isReady).toBe(true);
    });

    it('should emit ready event when initialized', async () => {
      const wrapper = mount(WhiteboardCanvas, {
        props: {
          width: 800,
          height: 600,
        },
      });

      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(wrapper.emitted('ready')).toBeTruthy();
    });
  });

  describe('props', () => {
    it('should accept background color prop', () => {
      const wrapper = mount(WhiteboardCanvas, {
        props: {
          width: 800,
          height: 600,
          backgroundColor: '#f0f0f0',
        },
      });

      expect(wrapper.props('backgroundColor')).toBe('#f0f0f0');
    });

    it('should react to dimension changes', async () => {
      const wrapper = mount(WhiteboardCanvas, {
        props: {
          width: 800,
          height: 600,
        },
      });

      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 100));

      await wrapper.setProps({ width: 1024, height: 768 });
      await nextTick();

      const canvas = wrapper.find('canvas').element as HTMLCanvasElement;
      expect(canvas.width).toBe(1024);
      expect(canvas.height).toBe(768);
    });
  });

  describe('exposed methods', () => {
    it('should expose setTool method', async () => {
      const wrapper = mount(WhiteboardCanvas, {
        props: {
          width: 800,
          height: 600,
        },
      });

      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(typeof (wrapper.vm as any).setTool).toBe('function');
    });

    it('should expose undo/redo methods', async () => {
      const wrapper = mount(WhiteboardCanvas, {
        props: {
          width: 800,
          height: 600,
        },
      });

      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(typeof (wrapper.vm as any).undo).toBe('function');
      expect(typeof (wrapper.vm as any).redo).toBe('function');
    });

    it('should expose clear method', async () => {
      const wrapper = mount(WhiteboardCanvas, {
        props: {
          width: 800,
          height: 600,
        },
      });

      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(typeof (wrapper.vm as any).clear).toBe('function');
    });

    it('should expose getCanvas method', async () => {
      const wrapper = mount(WhiteboardCanvas, {
        props: {
          width: 800,
          height: 600,
        },
      });

      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(typeof (wrapper.vm as any).getCanvas).toBe('function');
      const canvas = (wrapper.vm as any).getCanvas();
      expect(canvas).toBeTruthy();
    });
  });

  describe('state', () => {
    it('should expose reactive isReady state', async () => {
      const wrapper = mount(WhiteboardCanvas, {
        props: {
          width: 800,
          height: 600,
        },
      });

      // Wait for initialization
      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // After initialization, should be ready
      expect((wrapper.vm as any).isReady).toBe(true);
    });

    it('should expose reactive canUndo/canRedo state', async () => {
      const wrapper = mount(WhiteboardCanvas, {
        props: {
          width: 800,
          height: 600,
        },
      });

      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect((wrapper.vm as any).canUndo).toBeDefined();
      expect((wrapper.vm as any).canRedo).toBeDefined();
    });

    it('should expose reactive currentTool state', async () => {
      const wrapper = mount(WhiteboardCanvas, {
        props: {
          width: 800,
          height: 600,
        },
      });

      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect((wrapper.vm as any).currentTool).toBeDefined();
    });
  });

  describe('slots', () => {
    it('should support default slot', () => {
      const wrapper = mount(WhiteboardCanvas, {
        props: {
          width: 800,
          height: 600,
        },
        slots: {
          default: '<div class="toolbar">Toolbar</div>',
        },
      });

      expect(wrapper.html()).toContain('Toolbar');
    });
  });

  describe('cleanup', () => {
    it('should cleanup on unmount', async () => {
      const wrapper = mount(WhiteboardCanvas, {
        props: {
          width: 800,
          height: 600,
        },
      });

      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 100));

      wrapper.unmount();

      // Should not throw
      expect(true).toBe(true);
    });
  });
});
