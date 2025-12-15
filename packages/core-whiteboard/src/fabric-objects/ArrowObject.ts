import { fabric } from 'fabric';
import { EditableLine } from './EditableLine';

/**
 * ArrowObject
 * Extends EditableLine to include an arrow head
 */
export const ArrowObject = fabric.util.createClass(EditableLine, {
  type: 'arrow',

  initialize(points: number[], options: any) {
    this.callSuper('initialize', points, options);

    const headSize = Math.max(15, (this.strokeWidth || 1) * 3);

    this.arrowHead = new fabric.Triangle({
      width: headSize,
      height: headSize,
      fill: this.stroke,
      selectable: false,
      evented: false,
      hasBorders: false,
      hasControls: false,
      originX: 'center',
      originY: 'center',
      angle: 0,
    });

    // Disable object caching to prevent clipping of the arrow head
    // because the head is drawn outside the line's bounding box
    this.set('objectCaching', false);
  },

  /**
   * Update arrow head position and angle based on line coordinates
   * Calculates local coordinates relative to the object center
   */
  _updateHead() {
    if (!this.arrowHead) return;

    // calcLinePoints returns points relative to the object's center
    const p = this.calcLinePoints();

    const dx = p.x2 - p.x1;
    const dy = p.y2 - p.y1;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    // Sync styles
    const headSize = Math.max(15, (this.strokeWidth || 1) * 3);

    this.arrowHead.set({
      left: p.x2,
      top: p.y2,
      angle: angle + 90, // +90 because Triangle points up by default
      fill: this.stroke,
      width: headSize,
      height: headSize,
    });
  },

  _render(ctx: CanvasRenderingContext2D) {
    this.callSuper('_render', ctx);
    this._updateHead();
    this.arrowHead.render(ctx);
  }
});

// Implement fromObject for serialization/deserialization
ArrowObject.fromObject = function (
  object: Record<string, unknown>,
  callback?: (obj: fabric.Object) => void
) {
  const points = [
    object.x1 as number,
    object.y1 as number,
    object.x2 as number,
    object.y2 as number,
  ];

  const arrow = new ArrowObject(points, object);

  if (callback) {
    callback(arrow);
  }

  return arrow;
};

/**
 * Register ArrowObject for deserialization
 */
export function registerArrowObject() {
  (fabric as typeof fabric & { ArrowObject: typeof ArrowObject }).ArrowObject = ArrowObject;
  // Crucial: fabric looks for fabric.Arrow because type is 'arrow'
  (fabric as any).Arrow = ArrowObject;
}

export type ArrowObject = fabric.Line & {
  arrowHead: fabric.Triangle;
};
