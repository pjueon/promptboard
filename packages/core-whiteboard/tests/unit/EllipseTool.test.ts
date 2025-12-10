import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fabric } from 'fabric';
import { EllipseTool } from '../../src/tools/EllipseTool';
import { ToolConfig } from '../../src/types';

describe('EllipseTool', () => {
  let canvas: fabric.Canvas;
  let ellipseTool: EllipseTool;
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

    config = { color: 'blue', strokeWidth: 3 };
    onSnapshotSave = vi.fn();
    ellipseTool = new EllipseTool(canvas, config, onSnapshotSave);
  });

  it('should be instantiated', () => {
    expect(ellipseTool).toBeInstanceOf(EllipseTool);
  });

  it('should create an ellipse on mouse drag', () => {
    ellipseTool.activate();

    // Simulate mouse down
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 150,
      clientY: 150,
    });
    canvas.fire('mouse:down', { e: mouseDownEvent });

    // Simulate mouse move
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: 250,
      clientY: 200,
    });
    canvas.fire('mouse:move', { e: mouseMoveEvent });

    // Simulate mouse up
    const mouseUpEvent = new MouseEvent('mouseup');
    canvas.fire('mouse:up', { e: mouseUpEvent });

    expect(canvas.add).toHaveBeenCalled();
    const addedObject = (canvas.add as any).mock.calls[0][0];
    expect(addedObject).toBeInstanceOf(fabric.Ellipse);
    expect(addedObject.get('left')).toBe(150);
    expect(addedObject.get('top')).toBe(150);
    expect(addedObject.get('rx')).toBe(50);
    expect(addedObject.get('ry')).toBe(25);
    expect(addedObject.get('fill')).toBe('transparent');
    expect(addedObject.get('stroke')).toBe('blue');
    expect(addedObject.get('originX')).toBe('left');
    expect(addedObject.get('originY')).toBe('top');
    expect(canvas.setActiveObject).toHaveBeenCalledWith(addedObject);
  });

  it('should create a circle on mouse drag with shift key', () => {
    ellipseTool.activate();

    // Simulate mouse down
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 100,
      clientY: 100,
      shiftKey: true,
    });
    canvas.fire('mouse:down', { e: mouseDownEvent });

    // Simulate mouse move to create a non-circular shape if unconstrained
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
    expect(addedObject).toBeInstanceOf(fabric.Ellipse);

    // With shift key, rx and ry should be equal (a circle)
    const rx = addedObject.get('rx');
    const ry = addedObject.get('ry');
    expect(rx).toBe(ry);
    expect(rx).toBe(100); // Max dimension is 200, so radius is 100
    expect(addedObject.get('left')).toBe(100);
    expect(addedObject.get('top')).toBe(100);
  });
});
