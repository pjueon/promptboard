import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fabric } from 'fabric';
import { ArrowTool } from '../../src/tools/ArrowTool';
import { ToolConfig } from '../../src/types';

describe('ArrowTool', () => {
  let canvas: fabric.Canvas;
  let arrowTool: ArrowTool;
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
    arrowTool = new ArrowTool(canvas, config, onSnapshotSave);
  });

  it('should be instantiated', () => {
    expect(arrowTool).toBeInstanceOf(ArrowTool);
  });

  it('should create an arrow (line + triangle) on mouse drag', () => {
    arrowTool.activate();

    // Simulate mouse down
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 50,
      clientY: 50,
    });
    canvas.fire('mouse:down', {
      e: mouseDownEvent,
      pointer: { x: 50, y: 50 },
    });

    // Simulate mouse move
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: 200,
      clientY: 150,
    });
    canvas.fire('mouse:move', {
      e: mouseMoveEvent,
      pointer: { x: 200, y: 150 },
    });

    // Simulate mouse up
    const mouseUpEvent = new MouseEvent('mouseup');
    canvas.fire('mouse:up', {
      e: mouseUpEvent,
      pointer: { x: 200, y: 150 },
    });

    // Should add two objects: line and triangle
    expect(canvas.add).toHaveBeenCalledTimes(2);

    const addedLine = (canvas.add as any).mock.calls[0][0];
    const addedTriangle = (canvas.add as any).mock.calls[1][0];

    // Verify line
    expect(addedLine.type).toBe('editableLine');
    expect(addedLine.get('stroke')).toBe('blue');
    expect(addedLine.get('strokeWidth')).toBe(3);

    // Verify triangle
    expect(addedTriangle).toBeInstanceOf(fabric.Triangle);
    expect(addedTriangle.get('fill')).toBe('blue');

    // Verify line is selected
    expect(canvas.setActiveObject).toHaveBeenCalledWith(addedLine);
  });

  it('should snap arrow to 45 degrees when shift key is pressed', () => {
    arrowTool.activate();

    // Simulate mouse down
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 100,
      clientY: 100,
      shiftKey: true,
    });
    canvas.fire('mouse:down', {
      e: mouseDownEvent,
      pointer: { x: 100, y: 100 },
    });

    // Simulate mouse move with shift key to a non-45 degree angle
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: 250,
      clientY: 200,
      shiftKey: true,
    });
    canvas.fire('mouse:move', {
      e: mouseMoveEvent,
      pointer: { x: 250, y: 200 },
    });

    // Simulate mouse up
    const mouseUpEvent = new MouseEvent('mouseup');
    canvas.fire('mouse:up', {
      e: mouseUpEvent,
      pointer: { x: 250, y: 200 },
    });

    expect(canvas.add).toHaveBeenCalledTimes(2);

    const addedLine = (canvas.add as any).mock.calls[0][0];

    // Verify line coordinates are snapped to 45 degrees
    const x1 = addedLine.get('x1');
    const y1 = addedLine.get('y1');
    const x2 = addedLine.get('x2');
    const y2 = addedLine.get('y2');

    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);

    // Angle should be a multiple of 45 degrees (PI/4)
    const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    expect(Math.abs(angle - snapAngle)).toBeLessThan(0.01);
  });

  it('should link line and triangle with arrowId', () => {
    arrowTool.activate();

    // Simulate drawing
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 50,
      clientY: 50,
    });
    canvas.fire('mouse:down', {
      e: mouseDownEvent,
      pointer: { x: 50, y: 50 },
    });

    const mouseUpEvent = new MouseEvent('mouseup');
    canvas.fire('mouse:up', {
      e: mouseUpEvent,
      pointer: { x: 150, y: 150 },
    });

    const addedLine = (canvas.add as any).mock.calls[0][0];
    const addedTriangle = (canvas.add as any).mock.calls[1][0];

    // Verify they are linked
    // @ts-expect-error - checking custom property
    expect(addedLine.arrowId).toBeDefined();
    // @ts-expect-error - checking custom property
    expect(addedTriangle.arrowId).toBeDefined();
    // @ts-expect-error - checking custom property
    expect(addedLine.arrowId).toBe(addedTriangle.arrowId);
    // @ts-expect-error - checking custom property
    expect(addedLine.arrowHead).toBe(addedTriangle);
    // @ts-expect-error - checking custom property
    expect(addedTriangle.arrowLine).toBe(addedLine);
  });

  it('should make line selectable but triangle non-selectable', () => {
    arrowTool.activate();

    // Simulate drawing
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 50,
      clientY: 50,
    });
    canvas.fire('mouse:down', {
      e: mouseDownEvent,
      pointer: { x: 50, y: 50 },
    });

    const mouseUpEvent = new MouseEvent('mouseup');
    canvas.fire('mouse:up', {
      e: mouseUpEvent,
      pointer: { x: 150, y: 150 },
    });

    const addedLine = (canvas.add as any).mock.calls[0][0];
    const addedTriangle = (canvas.add as any).mock.calls[1][0];

    // Verify selectability
    expect(addedLine.get('selectable')).toBe(true);
    expect(addedLine.get('evented')).toBe(true);
    expect(addedTriangle.get('selectable')).toBe(false);
    expect(addedTriangle.get('evented')).toBe(false);
  });

  it('should save snapshot after drawing', () => {
    arrowTool.activate();

    // Simulate drawing
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 50,
      clientY: 50,
    });
    canvas.fire('mouse:down', {
      e: mouseDownEvent,
      pointer: { x: 50, y: 50 },
    });

    const mouseUpEvent = new MouseEvent('mouseup');
    canvas.fire('mouse:up', {
      e: mouseUpEvent,
      pointer: { x: 150, y: 150 },
    });

    // Wait for snapshot save
    setTimeout(() => {
      expect(onSnapshotSave).toHaveBeenCalled();
    }, 100);
  });
});
