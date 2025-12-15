import { fabric } from 'fabric';
import { ShapeTool } from './base/ShapeTool';
import type { ToolConfig, MouseEvent } from '../types/index';
import { ArrowObject } from '../fabric-objects/ArrowObject';

/**
 * Arrow drawing tool
 * Draws arrows (line + triangle head) using ArrowObject
 */
export class ArrowTool extends ShapeTool {
  constructor(
    canvas: fabric.Canvas,
    config: ToolConfig,
    onSnapshotSave?: () => void,
    onComplete?: () => void
  ) {
    super(canvas, config, onSnapshotSave, onComplete);
  }

  /**
   * Setup event handlers
   */
  protected setupEventHandlers(): void {
    this.mouseDownHandler = (e: MouseEvent) => this.onMouseDown(e);
    this.mouseMoveHandler = (e: MouseEvent) => this.onMouseMove(e);
    this.mouseUpHandler = (e: MouseEvent) => this.onMouseUp(e);

    this.canvas.on('mouse:down', this.mouseDownHandler as any);
    this.canvas.on('mouse:move', this.mouseMoveHandler as any);
    this.canvas.on('mouse:up', this.mouseUpHandler as any);
  }

  /**
   * Handle mouse down - start drawing arrow
   */
  protected onMouseDown(e: MouseEvent): void {
    const pointer = e.pointer;
    if (!pointer) return;

    this._isDrawing = true;
    this.startX = pointer.x;
    this.startY = pointer.y;

    // Disable canvas selection during drawing
    this.canvas.selection = false;

    // Create ArrowObject
    this.currentShape = new ArrowObject(
      [this.startX, this.startY, this.startX, this.startY],
      {
        stroke: this.config.color,
        strokeWidth: this.config.strokeWidth,
        selectable: false,
        evented: false,
        perPixelTargetFind: true,
        strokeUniform: true,
        originX: 'center',
        originY: 'center',
      }
    );

    if (this.currentShape) {
      this.canvas.add(this.currentShape);
    }
  }

  /**
   * Handle mouse move - update arrow endpoint
   */
  protected onMouseMove(e: MouseEvent): void {
    if (!this._isDrawing || !this.currentShape) return;

    const pointer = e.pointer;
    if (!pointer) return;

    let targetX = pointer.x;
    let targetY = pointer.y;

    // Snap to 45 degrees if Shift is pressed
    if (e.e && (e.e as KeyboardEvent).shiftKey) {
      const dx = targetX - this.startX;
      const dy = targetY - this.startY;

      if (dx !== 0 || dy !== 0) {
        const angle = Math.atan2(dy, dx);
        const length = Math.sqrt(dx * dx + dy * dy);

        // Snap to 45 degrees (PI/4)
        const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);

        targetX = this.startX + length * Math.cos(snapAngle);
        targetY = this.startY + length * Math.sin(snapAngle);
      }
    }

    // Update line endpoint
    (this.currentShape as fabric.Line).set({
      x2: targetX,
      y2: targetY,
    });
    
    // Update coordinates and bounding box
    this.currentShape.setCoords();

    // ArrowObject handles head update in _render automatically
    this.canvas.renderAll();
  }

  /**
   * Handle mouse up - finalize arrow
   */
  protected onMouseUp(e: MouseEvent): void {
    if (!this._isDrawing || !this.currentShape) return;

    // Re-enable canvas selection
    this.canvas.selection = true;

    const arrow = this.currentShape as ArrowObject;

    arrow.set({
      selectable: true,
      evented: true,
    });

    arrow.setCoords();

    // Select the arrow
    this.canvas.setActiveObject(arrow);

    // Save snapshot
    setTimeout(() => {
      this.saveSnapshot();
    }, 50);

    this._isDrawing = false;
    this.currentShape = null;

    this.canvas.renderAll();

    // Notify that drawing is complete
    this.notifyComplete();
  }

  /**
   * Clean up event listeners and temporary objects
   */
  protected cleanup(): void {
    // Call parent cleanup
    super.cleanup();
  }
}