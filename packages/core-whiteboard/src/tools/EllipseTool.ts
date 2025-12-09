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
      fill: this.config.color,
      stroke: this.config.color,
      strokeWidth: this.config.strokeWidth,
      selectable: false,
      evented: false,
    });
    return ellipse;
  }

  protected updateShape(
    x: number,
    y: number,
    isShiftPressed: boolean
  ): void {
    if (!this.currentShape) return;

    let rx = Math.abs(x - this.startX) / 2;
    let ry = Math.abs(y - this.startY) / 2;

    if (isShiftPressed) {
      const max = Math.max(rx, ry);
      rx = max;
      ry = max;
    }

    (this.currentShape as fabric.Ellipse).set({
      left: this.startX + (x - this.startX) / 2,
      top: this.startY + (y - this.startY) / 2,
      rx: rx,
      ry: ry,
    });
  }
}
