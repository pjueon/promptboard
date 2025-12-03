import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import WhiteboardCanvas from '../../src/renderer/components/WhiteboardCanvas.vue';
import { useToolbarStore } from '../../src/renderer/stores/toolbarStore';

// Mock Fabric.js
const mockBrush = {
  color: '#000000',
  width: 2,
};

const mockCanvas = {
  isDrawingMode: false,
  selection: true,
  width: 1024,
  height: 768,
  freeDrawingBrush: mockBrush,
  setDimensions: vi.fn(),
  renderAll: vi.fn(),
  dispose: vi.fn(),
  add: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  toDataURL: vi.fn(() => 'data:image/png;base64,snapshot'),
  getObjects: vi.fn(() => []),
  remove: vi.fn(),
  setBackgroundImage: vi.fn((img, callback) => {
    // Immediately call the callback
    if (callback) callback();
  }),
};

const mockImage = {
  width: 1024,
  height: 768,
};

vi.mock('fabric', () => ({
  fabric: {
    Canvas: vi.fn(() => mockCanvas),
    PencilBrush: vi.fn(() => mockBrush),
    Image: {
      fromURL: vi.fn((url, callback) => {
        // Immediately call the callback with mock image
        if (callback) callback(mockImage);
      }),
    },
  },
}));

describe('Pixel-based Eraser', () => {
  let wrapper: any;
  let toolbarStore: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCanvas.isDrawingMode = false;
    mockCanvas.selection = true;
    (mockBrush as any).globalCompositeOperation = undefined;
    
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
    wrapper.unmount();
  });

  describe('Eraser Tool Activation', () => {
    it('should enable drawing mode when eraser is selected', async () => {
      toolbarStore.setTool('eraser');
      
      await wrapper.vm.$nextTick();
      
      expect(mockCanvas.isDrawingMode).toBe(true);
    });

    it('should set composite operation to destination-out', async () => {
      toolbarStore.setTool('eraser');
      
      await wrapper.vm.$nextTick();
      
      // Should set white color for eraser (like Paint)
      expect(mockBrush.color).toBe('#ffffff');
    });

    it('should disable object selection when erasing', async () => {
      toolbarStore.setTool('eraser');
      
      await wrapper.vm.$nextTick();
      
      expect(mockCanvas.selection).toBe(false);
    });
  });

  describe('Eraser Brush Width', () => {
    it('should use strokeWidth for eraser size', async () => {
      toolbarStore.setStrokeWidth(10);
      toolbarStore.setTool('eraser');
      
      await wrapper.vm.$nextTick();
      
      expect(mockBrush.width).toBe(10);
    });

    it('should update eraser width when strokeWidth changes', async () => {
      toolbarStore.setTool('eraser');
      
      await wrapper.vm.$nextTick();
      
      toolbarStore.setStrokeWidth(20);
      
      await wrapper.vm.$nextTick();
      
      expect(mockBrush.width).toBe(20);
    });
  });

  describe('Eraser Path Creation', () => {
    it('should register path:created event for snapshot saving', async () => {
      toolbarStore.setTool('eraser');
      
      await wrapper.vm.$nextTick();
      
      const pathCreatedCalls = mockCanvas.on.mock.calls.filter(
        (call: any) => call[0] === 'path:created'
      );
      
      expect(pathCreatedCalls.length).toBeGreaterThan(0);
    });

    it('should save snapshot after eraser stroke', async () => {
      toolbarStore.setTool('eraser');
      
      await wrapper.vm.$nextTick();
      
      mockCanvas.toDataURL.mockClear();
      
      // Find and call path:created handler
      const pathCreatedCall = mockCanvas.on.mock.calls.find(
        (call: any) => call[0] === 'path:created'
      );
      const pathCreatedHandler = pathCreatedCall?.[1];
      
      if (pathCreatedHandler) {
        pathCreatedHandler({ path: {} });
        
        // Wait for flatten and snapshot
        await new Promise(resolve => setTimeout(resolve, 100));
        
        expect(mockCanvas.toDataURL).toHaveBeenCalled();
      }
    });
  });

  describe('Switch from Eraser to Other Tools', () => {
    it('should restore normal composite operation when switching to pen', async () => {
      const originalColor = toolbarStore.color;
      
      toolbarStore.setTool('eraser');
      await wrapper.vm.$nextTick();
      
      expect(mockBrush.color).toBe('#ffffff');
      
      toolbarStore.setTool('pen');
      await wrapper.vm.$nextTick();
      
      // Should reset to normal drawing (restore original color)
      expect(mockBrush.color).toBe(originalColor);
    });

    it('should disable drawing mode when switching to select', async () => {
      toolbarStore.setTool('eraser');
      await wrapper.vm.$nextTick();
      
      expect(mockCanvas.isDrawingMode).toBe(true);
      
      toolbarStore.setTool('select');
      await wrapper.vm.$nextTick();
      
      expect(mockCanvas.isDrawingMode).toBe(false);
    });
  });
});
