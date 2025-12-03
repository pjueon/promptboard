import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import WhiteboardCanvas from '../../src/renderer/components/WhiteboardCanvas.vue';
import { useToolbarStore } from '../../src/renderer/stores/toolbarStore';
import { useHistoryStore } from '../../src/renderer/stores/historyStore';

// Mock Fabric.js
const mockObject = {
  toDataURL: vi.fn(() => 'data:image/png;base64,objectImage'),
  set: vi.fn(),
  setCoords: vi.fn(),
};

const mockCanvas = {
  isDrawingMode: false,
  selection: true,
  width: 1024,
  height: 768,
  freeDrawingBrush: {
    color: '#000000',
    width: 2,
  },
  setDimensions: vi.fn(),
  renderAll: vi.fn(),
  dispose: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  setActiveObject: vi.fn(),
  getActiveObject: vi.fn(),
  discardActiveObject: vi.fn(),
  toDataURL: vi.fn(() => 'data:image/png;base64,canvasSnapshot'),
  clear: vi.fn(),
  setBackgroundImage: vi.fn((img, callback) => callback?.()),
  getObjects: vi.fn(() => []),
  on: vi.fn(),
  off: vi.fn(),
  forEachObject: vi.fn(),
};

vi.mock('fabric', () => ({
  fabric: {
    Canvas: vi.fn(() => mockCanvas),
    Image: {
      fromURL: vi.fn((url, callback) => {
        const mockImage = {
          width: 800,
          height: 600,
          scale: vi.fn(),
          set: vi.fn(),
        };
        callback(mockImage);
      }),
    },
  },
}));

describe('Flatten on Deselect', () => {
  let wrapper: VueWrapper<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCanvas.isDrawingMode = false;
    mockCanvas.selection = true;
    
    const pinia = createPinia();
    setActivePinia(pinia);
    useToolbarStore();
    useHistoryStore();

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

  describe('Selection Clear Event', () => {
    it('should register selection:cleared event listener', () => {
      const selectionClearedCalls = mockCanvas.on.mock.calls.filter(
        (call: [string, unknown]) => call[0] === 'selection:cleared'
      );
      
      expect(selectionClearedCalls.length).toBeGreaterThan(0);
    });

    it('should flatten object when selection is cleared', async () => {
      // Find the selection:cleared handler
      const selectionClearedCall = mockCanvas.on.mock.calls.find(
        (call: [string, unknown]) => call[0] === 'selection:cleared'
      );
      const selectionClearedHandler = selectionClearedCall?.[1] as (event: any) => void;
      
      expect(selectionClearedHandler).toBeDefined();
      
      // Setup getObjects to return mock object
      const mockObj = { type: 'rect' };
      (mockCanvas.getObjects as vi.Mock).mockReturnValue([mockObj]);
      
      // Simulate selection cleared event with deselected object
      const event = {
        deselected: [mockObj],
      };
      
      selectionClearedHandler(event);
      
      await wrapper.vm.$nextTick();
      
      // Should convert canvas to image (flatten)
      expect(mockCanvas.toDataURL).toHaveBeenCalled();
      expect(mockCanvas.getObjects).toHaveBeenCalled();
    });

    it('should save snapshot after flattening', async () => {
      const selectionClearedCall = mockCanvas.on.mock.calls.find(
        (call: [string, unknown]) => call[0] === 'selection:cleared'
      );
      const selectionClearedHandler = selectionClearedCall?.[1] as (event: any) => void;
      
      const event = {
        deselected: [mockObject],
      };
      
      selectionClearedHandler(event);
      
      await wrapper.vm.$nextTick();
      
      // Should save canvas snapshot
      expect(mockCanvas.toDataURL).toHaveBeenCalled();
    });

    it('should handle multiple objects being deselected', async () => {
      const selectionClearedCall = mockCanvas.on.mock.calls.find(
        (call: [string, unknown]) => call[0] === 'selection:cleared'
      );
      const selectionClearedHandler = selectionClearedCall?.[1] as (event: any) => void;
      
      const mockObject2 = { type: 'circle' };
      const event = {
        deselected: [mockObject, mockObject2],
      };
      
      (mockCanvas.getObjects as vi.Mock).mockReturnValue([mockObject, mockObject2]);
      
      selectionClearedHandler(event);
      
      await wrapper.vm.$nextTick();
      
      // Should flatten entire canvas
      expect(mockCanvas.toDataURL).toHaveBeenCalled();
    });

    it('should handle event with no deselected objects', async () => {
      const selectionClearedCall = mockCanvas.on.mock.calls.find(
        (call: [string, unknown]) => call[0] === 'selection:cleared'
      );
      const selectionClearedHandler = selectionClearedCall?.[1] as (event: any) => void;
      
      // Clear previous calls
      mockCanvas.toDataURL.mockClear();
      
      const event = {
        deselected: undefined,
      };
      
      selectionClearedHandler(event);
      
      await wrapper.vm.$nextTick();
      
      // Should not flatten
      expect(mockCanvas.toDataURL).not.toHaveBeenCalled();
    });
  });

  describe('Delete Key Before Flatten', () => {
    it('should delete selected object with Delete key', async () => {
      mockCanvas.getActiveObject.mockReturnValue(mockObject);
      
      const event = new KeyboardEvent('keydown', { key: 'Delete' });
      document.dispatchEvent(event);
      
      await wrapper.vm.$nextTick();
      
      // Should remove object immediately (before flatten)
      expect(mockCanvas.remove).toHaveBeenCalledWith(mockObject);
      expect(mockCanvas.discardActiveObject).toHaveBeenCalled();
    });

    it('should save snapshot after delete', async () => {
      mockCanvas.getActiveObject.mockReturnValue(mockObject);
      mockCanvas.toDataURL.mockClear();
      
      const event = new KeyboardEvent('keydown', { key: 'Delete' });
      document.dispatchEvent(event);
      
      await wrapper.vm.$nextTick();
      
      // Should save snapshot
      expect(mockCanvas.toDataURL).toHaveBeenCalled();
    });
  });

  describe('Pasted Screenshot Flatten', () => {
    it('should flatten pasted screenshot when deselected', async () => {
      // Skip clipboard test in unit test (requires E2E)
      // This test validates the flatten logic works with selection:cleared event
      
      const mockImage = { type: 'image' };
      
      // Simulate image added to canvas
      mockCanvas.add(mockImage);
      (mockCanvas.getObjects as vi.Mock).mockReturnValue([mockImage]);
      
      // Find selection:cleared handler
      const selectionClearedCall = mockCanvas.on.mock.calls.find(
        (call: [string, unknown]) => call[0] === 'selection:cleared'
      );
      const selectionClearedHandler = selectionClearedCall?.[1] as (event: any) => void;
      
      // Simulate deselection
      selectionClearedHandler({ deselected: [mockImage] });
      
      await wrapper.vm.$nextTick();
      
      // Should flatten (convert to background)
      expect(mockCanvas.toDataURL).toHaveBeenCalled();
    });
  });
});
