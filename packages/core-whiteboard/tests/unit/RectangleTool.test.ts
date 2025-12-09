import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fabric } from 'fabric';
import { RectangleTool } from '../../src/tools/RectangleTool';
import { ToolConfig } from '../../src/types';

describe('RectangleTool', () => {
  let canvas: fabric.Canvas;
  let rectangleTool: RectangleTool;
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

    config = { color: 'red', strokeWidth: 2 };
    onSnapshotSave = vi.fn();
    rectangleTool = new RectangleTool(canvas, config, onSnapshotSave);
  });

  it('should be instantiated', () => {
    expect(rectangleTool).toBeInstanceOf(RectangleTool);
  });

  it('should create a rectangle on mouse drag', () => {
    rectangleTool.activate();

    // Simulate mouse down
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 100,
      clientY: 150,
    });
    canvas.fire('mouse:down', { e: mouseDownEvent });

    // Simulate mouse move
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: 250,
      clientY: 300,
    });
    canvas.fire('mouse:move', { e: mouseMoveEvent });

    // Simulate mouse up
    const mouseUpEvent = new MouseEvent('mouseup');
    canvas.fire('mouse:up', { e: mouseUpEvent });

    expect(canvas.add).toHaveBeenCalled();
    const addedObject = (canvas.add as any).mock.calls[0][0];
    expect(addedObject).toBeInstanceOf(fabric.Rect);
    expect(addedObject.get('left')).toBe(100);
    expect(addedObject.get('top')).toBe(150);
    expect(addedObject.get('width')).toBe(150);
    expect(addedObject.get('height')).toBe(150);
    expect(addedObject.get('fill')).toBe('transparent');
    expect(addedObject.get('stroke')).toBe('red');
    expect(canvas.setActiveObject).toHaveBeenCalledWith(addedObject);
  });

  it('should create a square on mouse drag with shift key', () => {
    rectangleTool.activate();

    // Simulate mouse down
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 100,
      clientY: 100,
      shiftKey: true,
    });
    canvas.fire('mouse:down', { e: mouseDownEvent });

    // Simulate mouse move to create a non-square shape if unconstrained
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: 250,
      clientY: 300,
      shiftKey: true,
    });
    canvas.fire('mouse:move', { e: mouseMoveEvent });

    // Simulate mouse up
    const mouseUpEvent = new MouseEvent('mouseup');
    canvas.fire('mouse:up', { e: mouseUpEvent });

    expect(canvas.add).toHaveBeenCalled();
    const addedObject = (canvas.add as any).mock.calls[0][0];
    expect(addedObject).toBeInstanceOf(fabric.Rect);

    // With shift key, width and height should be equal (a square)
    // The largest dimension should dictate the size
    const width = addedObject.get('width');
    const height = addedObject.get('height');
    expect(width).toBe(height);
    expect(width).toBe(200); // 300 - 100
  });
});

