import { fabric } from 'fabric';
import { ConstrainedShapeTool } from './base/ConstrainedShapeTool';

export class EllipseTool extends ConstrainedShapeTool {
  protected createShape(
    x: number,
    y: number,
    isShiftPressed: boolean
  ): fabric.Object {
    const ellipse = new fabric.Ellipse({
      left: x,
      top: y,
      rx: 0,
      ry: 0,
      fill: 'transparent',
      stroke: this.config.color,
      strokeWidth: this.config.strokeWidth,
      selectable: false,
      evented: false,
      originX: 'left',
      originY: 'top',
    });
    return ellipse;
  }

  protected updateShape(
    x: number,
    y: number,
    isShiftPressed: boolean
  ): void {
    if (!this.currentShape) return;

    let width = x - this.startX;
    let height = y - this.startY;

    // Shift key -> Circle (equal width/height)
    if (isShiftPressed) {
      const maxDim = Math.max(Math.abs(width), Math.abs(height));
      width = width < 0 ? -maxDim : maxDim;
      height = height < 0 ? -maxDim : maxDim;
    }

    const rx = Math.abs(width) / 2;
    const ry = Math.abs(height) / 2;

    (this.currentShape as fabric.Ellipse).set({
      left: width < 0 ? this.startX + width : this.startX,
      top: height < 0 ? this.startY + height : this.startY,
      rx: rx,
      ry: ry,
    });
  }
}
