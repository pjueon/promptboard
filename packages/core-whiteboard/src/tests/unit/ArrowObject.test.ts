import { describe, it, expect } from 'vitest';
import { fabric } from 'fabric';
import { ArrowObject } from '../../fabric-objects/ArrowObject';

describe('ArrowObject', () => {
  it('should create an instance', () => {
    const arrow = new ArrowObject([0, 0, 100, 100], {
      stroke: 'red',
      strokeWidth: 2,
    });
    expect(arrow).toBeDefined();
    expect(arrow.type).toBe('arrow');
  });

  it('should initialize with an arrow head', () => {
    const arrow = new ArrowObject([0, 0, 100, 100], {});
    // Access internal property for testing
    // @ts-expect-error - accessing private/protected property
    expect(arrow.arrowHead).toBeDefined();
    // @ts-expect-error - accessing private/protected property
    expect(arrow.arrowHead).toBeInstanceOf(fabric.Triangle);
  });

  it('should update arrow head position and angle when coordinates change', () => {
    // Line from 0,0 to 100,0. Center is at 50,0.
    // Local coords: x1=-50, y1=0, x2=50, y2=0
    const arrow = new ArrowObject([0, 0, 100, 0], { strokeWidth: 2 });

    // Manually trigger update for testing
    // @ts-expect-error - accessing private method
    arrow._updateHead();

    // @ts-expect-error - accessing private property
    const head = arrow.arrowHead;

    // Head should be at the end point (local x=50, y=0)
    expect(head.left).toBeCloseTo(50);
    expect(head.top).toBeCloseTo(0);
    expect(head.angle).toBeCloseTo(90);

    // Change to vertical line [0, 0, 0, 100]. Center at 0,50.
    // Local coords: x1=0, y1=-50, x2=0, y2=50
    arrow.set({ x2: 0, y2: 100 });
    arrow.setCoords();
    
    // @ts-expect-error - accessing private method
    arrow._updateHead();

    // Head should be at the end point (local x=0, y=50)
    expect(head.left).toBeCloseTo(0);
    expect(head.top).toBeCloseTo(50);
    expect(head.angle).toBeCloseTo(180);
  });

  it('should sync arrow head style with line style', () => {
    const arrow = new ArrowObject([0, 0, 100, 100], {
      stroke: 'red',
      strokeWidth: 2,
    });

    // Initial state
    // @ts-expect-error - private property
    expect(arrow.arrowHead.fill).toBe('red');

    // Change color
    arrow.set({ stroke: 'blue' });
    // Trigger update (usually happens in render)
    // @ts-expect-error - private method
    arrow._updateHead();

    // @ts-expect-error - private property
    expect(arrow.arrowHead.fill).toBe('blue');

    // Change stroke width -> should change head size
    // Initial size for width 2 is max(15, 2*3=6) = 15
    // Let's set a large width
    arrow.set({ strokeWidth: 10 });
    // @ts-expect-error - private method
    arrow._updateHead();

    // Size should be max(15, 10*3=30) = 30
    // @ts-expect-error - private property
    expect(arrow.arrowHead.width).toBe(30);
    // @ts-expect-error - private property
    expect(arrow.arrowHead.height).toBe(30);
  });

  it('should serialize and deserialize correctly', () => {
    const arrow = new ArrowObject([0, 0, 100, 100], {
      stroke: 'red',
      strokeWidth: 2,
    });

    const json = arrow.toObject();
    expect(json.type).toBe('arrow');
    expect(json.stroke).toBe('red');

    // Simulate restoration
    let restoredArrow: any;
    // @ts-expect-error - static method
    ArrowObject.fromObject(json, (obj: any) => {
      restoredArrow = obj;
    });

    expect(restoredArrow).toBeDefined();
    // Check if it's an instance of ArrowObject (or at least behaves like one)
    expect(restoredArrow.type).toBe('arrow');
    
    // Check properties
    // Note: Fabric.js converts points to local coordinates relative to center.
    // So we compare geometric properties and position.
    
    const p1 = arrow.calcLinePoints();
    // @ts-expect-error - fabric object method
    const p2 = restoredArrow.calcLinePoints();
    
    expect(p2.x1).toBeCloseTo(p1.x1);
    expect(p2.y1).toBeCloseTo(p1.y1);
    expect(p2.x2).toBeCloseTo(p1.x2);
    expect(p2.y2).toBeCloseTo(p1.y2);

    expect(restoredArrow.left).toBeCloseTo(arrow.left as number);
    expect(restoredArrow.top).toBeCloseTo(arrow.top as number);
    
    // Check if arrowHead is initialized
    // @ts-expect-error - private property
    expect(restoredArrow.arrowHead).toBeDefined();
    // @ts-expect-error - private property
    expect(restoredArrow.arrowHead.fill).toBe('red');
  });
});
