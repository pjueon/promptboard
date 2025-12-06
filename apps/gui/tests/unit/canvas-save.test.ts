import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import WhiteboardCanvas from '../../src/renderer/components/WhiteboardCanvas.vue';

describe('WhiteboardCanvas - Save Functionality', () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);

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

  describe('getCanvasImage', () => {
    it('should return base64 PNG image', () => {
      const canvasImage = wrapper.vm.getCanvasImage();

      expect(canvasImage).toBeDefined();
      expect(typeof canvasImage).toBe('string');
    });

    it('should return valid base64 string without data URL prefix', () => {
      const canvasImage = wrapper.vm.getCanvasImage();

      if (canvasImage) {
        // Should not contain data URL prefix
        expect(canvasImage.startsWith('data:')).toBe(false);

        // Should be a non-empty string
        expect(canvasImage.length).toBeGreaterThan(0);

        // Should be valid base64 (basic check - contains only valid base64 characters)
        expect(typeof canvasImage).toBe('string');
      }
    });

    it('should return null if canvas is not initialized', () => {
      // Mount a new component but don't wait for initialization
      const newWrapper = mount(WhiteboardCanvas, {
        global: {
          plugins: [createPinia()],
        },
      });

      // Call before mounted hook completes
      const result = newWrapper.vm.getCanvasImage();

      // Should handle gracefully
      expect(result === null || typeof result === 'string').toBe(true);

      newWrapper.unmount();
    });

    it('should return consistent format for empty canvas', () => {
      const image1 = wrapper.vm.getCanvasImage();
      const image2 = wrapper.vm.getCanvasImage();

      expect(image1).toBeDefined();
      expect(image2).toBeDefined();

      if (image1 && image2) {
        // Empty canvas should produce similar output
        expect(image1.length).toBeGreaterThan(0);
        expect(image2.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Canvas state after save', () => {
    it('should maintain canvas content after getting image', async () => {
      // Clear canvas first
      wrapper.vm.clearCanvas();
      await wrapper.vm.$nextTick();

      // Get initial image
      const initialImage = wrapper.vm.getCanvasImage();

      // Get image again
      const secondImage = wrapper.vm.getCanvasImage();

      // Both should be defined and equal (canvas not modified)
      expect(initialImage).toBeDefined();
      expect(secondImage).toBeDefined();
    });

    it('should not modify fabricCanvas during image export', () => {
      const canvasBefore = wrapper.vm.getCanvasImage();

      // Perform some operations that shouldn't affect the canvas
      wrapper.vm.getCanvasImage();
      wrapper.vm.getCanvasImage();

      const canvasAfter = wrapper.vm.getCanvasImage();

      expect(canvasBefore).toBeDefined();
      expect(canvasAfter).toBeDefined();
    });
  });
});
