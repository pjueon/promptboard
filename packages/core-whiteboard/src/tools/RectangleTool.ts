import { fabric } from 'fabric';
import { ConstrainedShapeTool } from './base/ConstrainedShapeTool';

export class RectangleTool extends ConstrainedShapeTool {
  protected createShape(
    x: number,
    y: number,
    isShiftPressed: boolean
  ): fabric.Object {
    const rect = new fabric.Rect({
      left: x,
      top: y,
      width: 0,
      height: 0,
      fill: 'transparent',
      stroke: this.config.color,
      strokeWidth: this.config.strokeWidth,
      selectable: false,
      evented: false,
    });
    return rect;
  }

  protected updateShape(
    x: number,
    y: number,
    isShiftPressed: boolean
  ): void {
    if (!this.currentShape) return;

    let width = x - this.startX;
    let height = y - this.startY;

    if (isShiftPressed) {
      const max = Math.max(Math.abs(width), Math.abs(height));
      width = max * Math.sign(width);
      height = max * Math.sign(height);
    }

    this.currentShape.set({
      left: width > 0 ? this.startX : this.startX + width,
      top: height > 0 ? this.startY : this.startY + height,
      width: Math.abs(width),
      height: Math.abs(height),
    });
  }
}
