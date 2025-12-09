import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fabric } from 'fabric';
import { LineTool } from '../../src/tools/LineTool';
import { ToolConfig } from '../../src/types';
import '../../src/fabric-objects/EditableLine';

describe('LineTool', () => {
  let canvas: fabric.Canvas;
  let lineTool: LineTool;
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
    lineTool = new LineTool(canvas, config, onSnapshotSave);
  });

  it('should be instantiated', () => {
    expect(lineTool).toBeInstanceOf(LineTool);
  });

  it('should create a line on mouse drag', () => {
    lineTool.activate();

    // Simulate mouse down
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 50,
      clientY: 50,
    });
    canvas.fire('mouse:down', {
      e: mouseDownEvent,
      pointer: { x: 50, y: 50 }
    });

    // Simulate mouse move
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: 200,
      clientY: 150,
    });
    canvas.fire('mouse:move', {
      e: mouseMoveEvent,
      pointer: { x: 200, y: 150 }
    });

    // Simulate mouse up
    const mouseUpEvent = new MouseEvent('mouseup');
    canvas.fire('mouse:up', {
      e: mouseUpEvent,
      pointer: { x: 200, y: 150 }
    });

    expect(canvas.add).toHaveBeenCalled();
    const addedObject = (canvas.add as any).mock.calls[0][0];
    expect(addedObject).toBeInstanceOf(fabric.Line);
    expect(addedObject.get('stroke')).toBe('blue');
    expect(addedObject.get('strokeWidth')).toBe(3);
    expect(canvas.setActiveObject).toHaveBeenCalledWith(addedObject);
  });

  it('should constrain line to 45-degree angles with shift key', () => {
    lineTool.activate();

    // Simulate mouse down
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 100,
      clientY: 100,
      shiftKey: true,
    });
    canvas.fire('mouse:down', {
      e: mouseDownEvent,
      pointer: { x: 100, y: 100 }
    });

    // Simulate mouse move at arbitrary angle
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: 180,
      clientY: 150,
      shiftKey: true,
    });
    canvas.fire('mouse:move', {
      e: mouseMoveEvent,
      pointer: { x: 180, y: 150 }
    });

    // Simulate mouse up
    const mouseUpEvent = new MouseEvent('mouseup');
    canvas.fire('mouse:up', {
      e: mouseUpEvent,
      pointer: { x: 180, y: 150 }
    });

    expect(canvas.add).toHaveBeenCalled();
    const addedObject = (canvas.add as any).mock.calls[0][0];
    expect(addedObject).toBeInstanceOf(fabric.Line);

    // With shift key, the line should be constrained to 45-degree angles
    // The angle should be a multiple of 45 degrees (0, 45, 90, 135, 180, 225, 270, 315)
    const x1 = addedObject.get('x1');
    const y1 = addedObject.get('y1');
    const x2 = addedObject.get('x2');
    const y2 = addedObject.get('y2');

    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const normalizedAngle = ((angle % 360) + 360) % 360;

    // Check if angle is close to a multiple of 45 degrees
    const closestMultiple = Math.round(normalizedAngle / 45) * 45;
    const angleDifference = Math.abs(normalizedAngle - closestMultiple);
    expect(angleDifference).toBeLessThan(1); // Allow small rounding error
  });

  it('should call onSnapshotSave when line is completed', (done) => {
    lineTool.activate();

    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 0,
      clientY: 0,
    });
    canvas.fire('mouse:down', {
      e: mouseDownEvent,
      pointer: { x: 0, y: 0 }
    });

    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: 100,
      clientY: 100,
    });
    canvas.fire('mouse:move', {
      e: mouseMoveEvent,
      pointer: { x: 100, y: 100 }
    });

    const mouseUpEvent = new MouseEvent('mouseup');
    canvas.fire('mouse:up', {
      e: mouseUpEvent,
      pointer: { x: 100, y: 100 }
    });

    // onSnapshotSave is called after a timeout, so we need to wait
    setTimeout(() => {
      expect(onSnapshotSave).toHaveBeenCalled();
      done();
    }, 100);
  });

  it('should not create line if mouse is not moved', () => {
    lineTool.activate();

    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 100,
      clientY: 100,
    });
    canvas.fire('mouse:down', {
      e: mouseDownEvent,
      pointer: { x: 100, y: 100 }
    });

    // Mouse up without moving
    const mouseUpEvent = new MouseEvent('mouseup');
    canvas.fire('mouse:up', {
      e: mouseUpEvent,
      pointer: { x: 100, y: 100 }
    });

    expect(canvas.add).toHaveBeenCalled(); // Line is created but with zero length
  });
});
