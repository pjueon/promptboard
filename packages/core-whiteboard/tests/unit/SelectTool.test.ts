import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fabric } from 'fabric';
import { SelectTool } from '../../src/tools/SelectTool';
import { ToolConfig } from '../../src/types';

describe('SelectTool', () => {
  let canvas: fabric.Canvas;
  let selectTool: SelectTool;
  let config: ToolConfig;

  beforeEach(() => {
    // Mock canvas
    canvas = new fabric.Canvas(null);
    vi.spyOn(canvas, 'add').mockImplementation(() => canvas);
    vi.spyOn(canvas, 'remove').mockImplementation(() => canvas);
    vi.spyOn(canvas, 'renderAll').mockImplementation(() => {});
    vi.spyOn(canvas, 'discardActiveObject').mockImplementation(() => canvas);

    config = { color: 'black', strokeWidth: 2 };
    selectTool = new SelectTool(canvas, config);
  });

  it('should be instantiated', () => {
    expect(selectTool).toBeInstanceOf(SelectTool);
  });

  it('should return false for isDrawing() initially', () => {
    expect(selectTool.isDrawing()).toBe(false);
  });

  it('should enable canvas selection on activate', () => {
    selectTool.activate();
    expect(canvas.selection).toBe(true);
  });

  it('should not create selection rect when clicking on object', () => {
    selectTool.activate();

    const mockObject = new fabric.Rect({ width: 100, height: 100 });

    // Simulate mouse down on an object
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 50,
      clientY: 50,
    });
    canvas.fire('mouse:down', {
      e: mouseDownEvent,
      pointer: { x: 50, y: 50 },
      target: mockObject, // Clicking on an object
    });

    // Should not add any selection rectangle
    expect(canvas.add).not.toHaveBeenCalled();
  });

  it('should create selection rect when clicking on empty space', () => {
    selectTool.activate();

    // Simulate mouse down on empty space
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 100,
      clientY: 100,
    });
    canvas.fire('mouse:down', {
      e: mouseDownEvent,
      pointer: { x: 100, y: 100 },
      target: undefined, // No target = empty space
    });

    // Should add selection rectangle
    expect(canvas.add).toHaveBeenCalledTimes(1);

    const addedRect = (canvas.add as any).mock.calls[0][0];
    expect(addedRect).toBeInstanceOf(fabric.Rect);
    expect(addedRect.get('left')).toBe(100);
    expect(addedRect.get('top')).toBe(100);
    expect(addedRect.get('width')).toBe(0);
    expect(addedRect.get('height')).toBe(0);
  });

  it('should have dashed stroke for selection rectangle', () => {
    selectTool.activate();

    // Start selection
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 50,
      clientY: 50,
    });
    canvas.fire('mouse:down', {
      e: mouseDownEvent,
      pointer: { x: 50, y: 50 },
    });

    const addedRect = (canvas.add as any).mock.calls[0][0];
    expect(addedRect.get('strokeDashArray')).toEqual([5, 5]);
    expect(addedRect.get('stroke')).toBe('#000000');
    expect(addedRect.get('strokeWidth')).toBe(1);
  });

  it('should update selection rectangle on mouse move', () => {
    selectTool.activate();

    // Start selection
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 50,
      clientY: 50,
    });
    canvas.fire('mouse:down', {
      e: mouseDownEvent,
      pointer: { x: 50, y: 50 },
    });

    const rect = (canvas.add as any).mock.calls[0][0];
    const setSpy = vi.spyOn(rect, 'set');

    // Move mouse
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: 150,
      clientY: 200,
    });
    canvas.fire('mouse:move', {
      e: mouseMoveEvent,
      pointer: { x: 150, y: 200 },
    });

    // Should update rectangle dimensions
    expect(setSpy).toHaveBeenCalledWith({
      left: 50,
      top: 50,
      width: 100,
      height: 150,
    });
  });

  it('should handle negative dimensions (dragging left/up)', () => {
    selectTool.activate();

    // Start selection
    canvas.fire('mouse:down', {
      e: new MouseEvent('mousedown'),
      pointer: { x: 100, y: 100 },
    });

    const rect = (canvas.add as any).mock.calls[0][0];
    const setSpy = vi.spyOn(rect, 'set');

    // Drag left and up
    canvas.fire('mouse:move', {
      e: new MouseEvent('mousemove'),
      pointer: { x: 50, y: 60 },
    });

    // Should update with adjusted left/top and positive dimensions
    expect(setSpy).toHaveBeenCalledWith({
      left: 50, // pointer.x (left of start)
      top: 60, // pointer.y (above start)
      width: 50, // abs(50 - 100)
      height: 40, // abs(60 - 100)
    });
  });

  it('should set isDrawing to true when drawing', () => {
    selectTool.activate();

    canvas.fire('mouse:down', {
      e: new MouseEvent('mousedown'),
      pointer: { x: 50, y: 50 },
    });

    expect(selectTool.isDrawing()).toBe(true);
  });

  it('should set isDrawing to false on mouse up', () => {
    selectTool.activate();

    canvas.fire('mouse:down', {
      e: new MouseEvent('mousedown'),
      pointer: { x: 50, y: 50 },
    });

    expect(selectTool.isDrawing()).toBe(true);

    canvas.fire('mouse:up', {
      e: new MouseEvent('mouseup'),
    });

    expect(selectTool.isDrawing()).toBe(false);
  });

  it('should re-enable canvas selection after drawing', () => {
    selectTool.activate();

    canvas.fire('mouse:down', {
      e: new MouseEvent('mousedown'),
      pointer: { x: 50, y: 50 },
    });

    // Selection should be disabled during drawing
    expect(canvas.selection).toBe(false);

    canvas.fire('mouse:up', {
      e: new MouseEvent('mouseup'),
    });

    // Selection should be re-enabled
    expect(canvas.selection).toBe(true);
  });

  it('should provide access to selection rectangle', () => {
    selectTool.activate();

    expect(selectTool.getSelectionRect()).toBeNull();

    canvas.fire('mouse:down', {
      e: new MouseEvent('mousedown'),
      pointer: { x: 50, y: 50 },
    });

    const rect = selectTool.getSelectionRect();
    expect(rect).toBeInstanceOf(fabric.Rect);
  });

  it('should remove selection rectangle on cleanup', () => {
    selectTool.activate();

    canvas.fire('mouse:down', {
      e: new MouseEvent('mousedown'),
      pointer: { x: 50, y: 50 },
    });

    expect(selectTool.getSelectionRect()).not.toBeNull();

    selectTool.deactivate();

    expect(canvas.remove).toHaveBeenCalled();
    expect(selectTool.getSelectionRect()).toBeNull();
  });

  it('should remove previous selection when starting new one', () => {
    selectTool.activate();

    // First selection
    canvas.fire('mouse:down', {
      e: new MouseEvent('mousedown'),
      pointer: { x: 50, y: 50 },
    });

    const firstRect = selectTool.getSelectionRect();

    // Second selection
    canvas.fire('mouse:down', {
      e: new MouseEvent('mousedown'),
      pointer: { x: 100, y: 100 },
    });

    // Should remove first rectangle
    expect(canvas.remove).toHaveBeenCalledWith(firstRect);
  });
});
