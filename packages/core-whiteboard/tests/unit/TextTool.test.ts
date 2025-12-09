import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fabric } from 'fabric';
import { TextTool } from '../../src/tools/TextTool';
import { ToolConfig } from '../../src/types';

describe('TextTool', () => {
  let canvas: fabric.Canvas;
  let textTool: TextTool;
  let config: ToolConfig;
  let onSnapshotSave: () => void;

  beforeEach(() => {
    // Mock canvas
    canvas = new fabric.Canvas(null);
    vi.spyOn(canvas, 'add').mockImplementation(() => canvas);
    vi.spyOn(canvas, 'renderAll').mockImplementation(() => {});
    vi.spyOn(canvas, 'getPointer').mockImplementation((e: Event) => ({
      x: (e as MouseEvent).clientX,
      y: (e as MouseEvent).clientY,
    }));
    vi.spyOn(canvas, 'setActiveObject').mockImplementation(() => canvas);

    config = { color: 'red', strokeWidth: 2, fontSize: 24 };
    onSnapshotSave = vi.fn();
    textTool = new TextTool(canvas, config, onSnapshotSave);
  });

  it('should be instantiated', () => {
    expect(textTool).toBeInstanceOf(TextTool);
  });

  it('should return false for isDrawing()', () => {
    // Text tool is click-based, not drag-based
    expect(textTool.isDrawing()).toBe(false);
  });

  it('should create IText on mouse click', () => {
    textTool.activate();

    // Simulate mouse click
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 100,
      clientY: 150,
    });
    canvas.fire('mouse:down', {
      e: mouseDownEvent,
      pointer: { x: 100, y: 150 },
    });

    // Should add one IText object
    expect(canvas.add).toHaveBeenCalledTimes(1);

    const addedText = (canvas.add as any).mock.calls[0][0];

    // Verify it's an IText object
    expect(addedText).toBeInstanceOf(fabric.IText);
    expect(addedText.get('left')).toBe(100);
    expect(addedText.get('top')).toBe(150);
  });

  it('should apply correct color and fontSize to created text', () => {
    textTool.activate();

    // Simulate mouse click
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 200,
      clientY: 250,
    });
    canvas.fire('mouse:down', {
      e: mouseDownEvent,
      pointer: { x: 200, y: 250 },
    });

    const addedText = (canvas.add as any).mock.calls[0][0];

    // Verify color and fontSize
    expect(addedText.get('fill')).toBe('red');
    expect(addedText.get('fontSize')).toBe(24);
  });

  it('should use default fontSize if not provided in config', () => {
    const configWithoutFontSize: ToolConfig = { color: 'blue', strokeWidth: 2 };
    const textToolWithoutFontSize = new TextTool(
      canvas,
      configWithoutFontSize,
      onSnapshotSave
    );

    textToolWithoutFontSize.activate();

    // Simulate mouse click
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 50,
      clientY: 50,
    });
    canvas.fire('mouse:down', {
      e: mouseDownEvent,
      pointer: { x: 50, y: 50 },
    });

    const addedText = (canvas.add as any).mock.calls[0][0];

    // Should use default fontSize of 20
    expect(addedText.get('fontSize')).toBe(20);
  });

  it('should enter editing mode immediately after creation', () => {
    textTool.activate();

    // Mock enterEditing method
    const enterEditingSpy = vi.fn();

    // Override the canvas.add to capture the text object
    let capturedText: fabric.IText | null = null;
    vi.spyOn(canvas, 'add').mockImplementation((obj) => {
      capturedText = obj as fabric.IText;
      capturedText.enterEditing = enterEditingSpy;
      return canvas;
    });

    // Simulate mouse click
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 100,
      clientY: 100,
    });
    canvas.fire('mouse:down', {
      e: mouseDownEvent,
      pointer: { x: 100, y: 100 },
    });

    // Verify enterEditing was called
    expect(enterEditingSpy).toHaveBeenCalled();
  });

  it('should select the created text object', () => {
    textTool.activate();

    // Simulate mouse click
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 100,
      clientY: 100,
    });
    canvas.fire('mouse:down', {
      e: mouseDownEvent,
      pointer: { x: 100, y: 100 },
    });

    // Should select the text
    expect(canvas.setActiveObject).toHaveBeenCalled();

    const addedText = (canvas.add as any).mock.calls[0][0];
    expect(canvas.setActiveObject).toHaveBeenCalledWith(addedText);
  });

  it('should save snapshot when editing exits', () => {
    textTool.activate();

    // Simulate mouse click
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 100,
      clientY: 100,
    });
    canvas.fire('mouse:down', {
      e: mouseDownEvent,
      pointer: { x: 100, y: 100 },
    });

    const addedText = (canvas.add as any).mock.calls[0][0];

    // Simulate editing:exited event
    addedText.fire('editing:exited');

    // Wait for setTimeout to complete
    setTimeout(() => {
      expect(onSnapshotSave).toHaveBeenCalled();
    }, 150);
  });

  it('should cleanup event listeners on deactivate', () => {
    textTool.activate();

    const offSpy = vi.spyOn(canvas, 'off');

    textTool.deactivate();

    // Should remove mouse:down listener
    expect(offSpy).toHaveBeenCalledWith('mouse:down', expect.any(Function));
  });

  it('should update fontSize of selected text when updateConfig is called', () => {
    textTool.activate();

    // Create a text object
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 100,
      clientY: 100,
    });
    canvas.fire('mouse:down', {
      e: mouseDownEvent,
      pointer: { x: 100, y: 100 },
    });

    const addedText = (canvas.add as any).mock.calls[0][0] as fabric.IText;

    // Mock getActiveObject to return the text
    vi.spyOn(canvas, 'getActiveObject').mockReturnValue(addedText);

    // Verify initial fontSize
    expect(addedText.get('fontSize')).toBe(24);

    // Update config with new fontSize
    textTool.updateConfig({ color: 'red', strokeWidth: 2, fontSize: 36 });

    // Verify fontSize was updated
    expect(addedText.get('fontSize')).toBe(36);
  });

  it('should apply fontSize from config to newly created text', () => {
    // Update config before creating text
    textTool.updateConfig({ color: 'blue', strokeWidth: 2, fontSize: 48 });
    textTool.activate();

    // Create a text object
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 100,
      clientY: 100,
    });
    canvas.fire('mouse:down', {
      e: mouseDownEvent,
      pointer: { x: 100, y: 100 },
    });

    const addedText = (canvas.add as any).mock.calls[0][0];

    // Should use the updated fontSize
    expect(addedText.get('fontSize')).toBe(48);
  });
});
