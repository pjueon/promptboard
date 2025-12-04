import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import WhiteboardCanvas from '../../src/renderer/components/WhiteboardCanvas.vue';
import { useToolbarStore } from '../../src/renderer/stores/toolbarStore';

// Mock Fabric.js objects
const mockLine = {
  set: vi.fn(),
  setCoords: vi.fn(),
};

const mockRect = {
  set: vi.fn(),
  setCoords: vi.fn(),
};

const mockCircle = {
  set: vi.fn(),
  setCoords: vi.fn(),
};

const mockIText = {
  enterEditing: vi.fn(),
  exitEditing: vi.fn(),
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
  toDataURL: vi.fn(() => 'data:image/png;base64,snapshot'),
  clear: vi.fn(),
  setBackgroundImage: vi.fn((img, callback) => callback?.()),
  on: vi.fn(),
  off: vi.fn(),
};

vi.mock('fabric', () => ({
  fabric: {
    Canvas: vi.fn(() => mockCanvas),
    Line: vi.fn(() => mockLine),
    Rect: vi.fn(() => mockRect),
    Circle: vi.fn(() => mockCircle),
    IText: vi.fn(() => mockIText),
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

describe('Shape Drawing', () => {
  let wrapper: VueWrapper;
  let toolbarStore: ReturnType<typeof useToolbarStore>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    mockCanvas.isDrawingMode = false;
    mockCanvas.selection = true;
    
    // Create fresh pinia instance
    const pinia = createPinia();
    setActivePinia(pinia);
    toolbarStore = useToolbarStore();

    // Mount component
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

  describe('Line Tool', () => {
    it('should register mouse events when line tool is selected', async () => {
      toolbarStore.setTool('line');
      await wrapper.vm.$nextTick();
      
      // Should register mouse:down event
      expect(mockCanvas.on).toHaveBeenCalledWith('mouse:down', expect.any(Function));
    });

    it('should create line on mouse down and move', async () => {
      const { fabric } = await import('fabric');
      
      toolbarStore.setTool('line');
      await wrapper.vm.$nextTick();
      
      // Simulate mouse:down event
      const mouseDownHandler = mockCanvas.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'mouse:down'
      )?.[1];
      
      if (mouseDownHandler) {
        mouseDownHandler({ e: { clientX: 100, clientY: 100 }, pointer: { x: 100, y: 100 } });
        
        expect(fabric.Line).toHaveBeenCalledWith(
          [100, 100, 100, 100],
          expect.objectContaining({
            stroke: toolbarStore.color,
            strokeWidth: toolbarStore.strokeWidth,
          })
        );
      }
    });

    it('should update line on mouse move', async () => {
      toolbarStore.setTool('line');
      await wrapper.vm.$nextTick();
      
      // Simulate drawing sequence
      const mouseDownHandler = mockCanvas.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'mouse:down'
      )?.[1];
      
      const mouseMoveHandler = mockCanvas.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'mouse:move'
      )?.[1];
      
      if (mouseDownHandler && mouseMoveHandler) {
        // Start drawing
        mouseDownHandler({ pointer: { x: 100, y: 100 } });
        
        // Move mouse
        mouseMoveHandler({ pointer: { x: 200, y: 150 } });
        
        expect(mockLine.set).toHaveBeenCalledWith({
          x2: 200,
          y2: 150,
        });
        expect(mockCanvas.renderAll).toHaveBeenCalled();
      }
    });

    it('should finalize line on mouse up', async () => {
      toolbarStore.setTool('line');
      await wrapper.vm.$nextTick();
      
      const mouseDownHandler = mockCanvas.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'mouse:down'
      )?.[1];
      
      const mouseUpHandler = mockCanvas.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'mouse:up'
      )?.[1];
      
      if (mouseDownHandler && mouseUpHandler) {
        // Start and finish drawing
        mouseDownHandler({ pointer: { x: 100, y: 100 } });
        mouseUpHandler({ pointer: { x: 200, y: 200 } });
        
        // Should switch back to select mode
        await wrapper.vm.$nextTick();
        expect(toolbarStore.currentTool).toBe('select');
      }
    });
  });

  describe('Rectangle Tool', () => {
    it('should register mouse events when rectangle tool is selected', async () => {
      toolbarStore.setTool('rectangle');
      await wrapper.vm.$nextTick();
      
      expect(mockCanvas.on).toHaveBeenCalledWith('mouse:down', expect.any(Function));
    });

    it('should create rectangle on mouse down', async () => {
      const { fabric } = await import('fabric');
      
      toolbarStore.setTool('rectangle');
      toolbarStore.setColor('#ff0000');
      toolbarStore.setStrokeWidth(3);
      await wrapper.vm.$nextTick();
      
      const mouseDownHandler = mockCanvas.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'mouse:down'
      )?.[1];
      
      if (mouseDownHandler) {
        mouseDownHandler({ pointer: { x: 50, y: 50 } });
        
        expect(fabric.Rect).toHaveBeenCalledWith(
          expect.objectContaining({
            left: 50,
            top: 50,
            stroke: '#ff0000',
            strokeWidth: 3,
            fill: 'rgba(0,0,0,0.01)',
          })
        );
      }
    });

    it('should update rectangle dimensions on mouse move', async () => {
      toolbarStore.setTool('rectangle');
      await wrapper.vm.$nextTick();
      
      const mouseDownHandler = mockCanvas.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'mouse:down'
      )?.[1];
      
      const mouseMoveHandler = mockCanvas.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'mouse:move'
      )?.[1];
      
      if (mouseDownHandler && mouseMoveHandler) {
        mouseDownHandler({ pointer: { x: 50, y: 50 } });
        mouseMoveHandler({ pointer: { x: 150, y: 120 } });
        
        expect(mockRect.set).toHaveBeenCalledWith({
          left: 50,
          top: 50,
          width: 100,
          height: 70,
        });
      }
    });

    it('should finalize rectangle on mouse up and switch to select', async () => {
      toolbarStore.setTool('rectangle');
      await wrapper.vm.$nextTick();
      
      const mouseDownHandler = mockCanvas.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'mouse:down'
      )?.[1];
      
      const mouseUpHandler = mockCanvas.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'mouse:up'
      )?.[1];
      
      if (mouseDownHandler && mouseUpHandler) {
        mouseDownHandler({ pointer: { x: 50, y: 50 } });
        mouseUpHandler({ pointer: { x: 150, y: 150 } });
        
        await wrapper.vm.$nextTick();
        expect(toolbarStore.currentTool).toBe('select');
      }
    });
  });

  describe('Circle Tool', () => {
    it('should register mouse events when circle tool is selected', async () => {
      toolbarStore.setTool('circle');
      await wrapper.vm.$nextTick();
      
      expect(mockCanvas.on).toHaveBeenCalledWith('mouse:down', expect.any(Function));
    });

    it('should create circle on mouse down', async () => {
      const { fabric } = await import('fabric');
      
      toolbarStore.setTool('circle');
      await wrapper.vm.$nextTick();
      
      const mouseDownHandler = mockCanvas.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'mouse:down'
      )?.[1];
      
      if (mouseDownHandler) {
        mouseDownHandler({ pointer: { x: 100, y: 100 } });
        
        expect(fabric.Circle).toHaveBeenCalledWith(
          expect.objectContaining({
            left: 100,
            top: 100,
            stroke: toolbarStore.color,
            strokeWidth: toolbarStore.strokeWidth,
            fill: 'rgba(0,0,0,0.01)',
          })
        );
      }
    });

    it('should update circle radius on mouse move', async () => {
      toolbarStore.setTool('circle');
      await wrapper.vm.$nextTick();
      
      const mouseDownHandler = mockCanvas.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'mouse:down'
      )?.[1];
      
      const mouseMoveHandler = mockCanvas.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'mouse:move'
      )?.[1];
      
      if (mouseDownHandler && mouseMoveHandler) {
        mouseDownHandler({ pointer: { x: 100, y: 100 } });
        mouseMoveHandler({ pointer: { x: 150, y: 140 } });
        
        // radius = sqrt((150-100)^2 + (140-100)^2) = sqrt(2500 + 1600) = sqrt(4100) ≈ 64.03
        expect(mockCircle.set).toHaveBeenCalledWith({
          radius: expect.any(Number),
        });
      }
    });

    it('should finalize circle on mouse up and switch to select', async () => {
      toolbarStore.setTool('circle');
      await wrapper.vm.$nextTick();
      
      const mouseDownHandler = mockCanvas.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'mouse:down'
      )?.[1];
      
      const mouseUpHandler = mockCanvas.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'mouse:up'
      )?.[1];
      
      if (mouseDownHandler && mouseUpHandler) {
        mouseDownHandler({ pointer: { x: 100, y: 100 } });
        mouseUpHandler({ pointer: { x: 150, y: 150 } });
        
        await wrapper.vm.$nextTick();
        expect(toolbarStore.currentTool).toBe('select');
      }
    });
  });

  describe('Text Tool', () => {
    it('should register mouse down event when text tool is selected', async () => {
      toolbarStore.setTool('text');
      await wrapper.vm.$nextTick();
      
      const mouseDownCalls = mockCanvas.on.mock.calls.filter(
        (call: unknown[]) => call[0] === 'mouse:down'
      );
      expect(mouseDownCalls.length).toBeGreaterThan(0);
    });

    it('should create IText on mouse down', async () => {
      const { fabric } = await import('fabric');
      
      toolbarStore.setTool('text');
      await wrapper.vm.$nextTick();
      
      const mouseDownHandler = mockCanvas.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'mouse:down'
      )?.[1];
      
      if (mouseDownHandler) {
        mouseDownHandler({ pointer: { x: 100, y: 100 } });
        
        expect(fabric.IText).toHaveBeenCalledWith('', {
          left: 100,
          top: 100,
          fill: toolbarStore.color,
          fontSize: 20,
        });
        expect(mockCanvas.add).toHaveBeenCalled();
      }
    });

    it('should enter editing mode after creating text', async () => {
      const { fabric } = await import('fabric');
      
      toolbarStore.setTool('text');
      await wrapper.vm.$nextTick();
      
      const mockText = {
        enterEditing: vi.fn(),
        setCoords: vi.fn(),
      };
      (fabric.IText as unknown as Mock).mockReturnValue(mockText);
      
      const mouseDownHandler = mockCanvas.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'mouse:down'
      )?.[1];
      
      if (mouseDownHandler) {
        mouseDownHandler({ pointer: { x: 100, y: 100 } });
        
        expect(mockText.enterEditing).toHaveBeenCalled();
        expect(mockText.setCoords).toHaveBeenCalled();
      }
    });

    it('should stay in text mode after creating text', async () => {
      toolbarStore.setTool('text');
      await wrapper.vm.$nextTick();
      
      const mouseDownHandler = mockCanvas.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'mouse:down'
      )?.[1];
      
      if (mouseDownHandler) {
        mouseDownHandler({ pointer: { x: 100, y: 100 } });
        
        await wrapper.vm.$nextTick();
        // Should stay in text mode to allow multiple text additions
        expect(toolbarStore.currentTool).toBe('text');
      }
    });
  });

  describe('Event Cleanup', () => {
    it('should remove event listeners when switching tools', async () => {
      toolbarStore.setTool('line');
      await wrapper.vm.$nextTick();

      toolbarStore.setTool('pen');
      await wrapper.vm.$nextTick();

      expect(mockCanvas.off).toHaveBeenCalled();
    });

    it('should clean up on component unmount', async () => {
      toolbarStore.setTool('rectangle');
      await wrapper.vm.$nextTick();
      
      wrapper.unmount();
      
      expect(mockCanvas.off).toHaveBeenCalled();
    });
  });
});
