import type { fabric } from 'fabric';
import { ShapeTool } from './ShapeTool';
import type { ToolConfig, MouseEvent } from '../../types/index';

/**
 * Base class for shape drawing tools that support Shift key constraints
 * (e.g., perfect circles, squares, or lines constrained to 0, 45, 90 degrees)
 */
export abstract class ConstrainedShapeTool extends ShapeTool {
  constructor(
    canvas: fabric.Canvas,
    config: ToolConfig,
    onSnapshotSave?: () => void,
    onComplete?: () => void
  ) {
    super(canvas, config, onSnapshotSave, onComplete);
  }

  /**
   * Setup event handlers for drawing.
   * This implementation will bind the common mouse handlers.
   */
  protected setupEventHandlers(): void {
    this.mouseDownHandler = this.onMouseDown.bind(this);
    this.mouseMoveHandler = this.onMouseMove.bind(this);
    this.mouseUpHandler = this.onMouseUp.bind(this);

    this.canvas.on('mouse:down', this.mouseDownHandler as any);
    this.canvas.on('mouse:move', this.mouseMoveHandler as any);
    this.canvas.on('mouse:up', this.mouseUpHandler as any);
  }

  /**
   * Abstract method to be implemented by concrete constrained shape tools.
   * This method should create the initial shape.
   */
  protected abstract createShape(
    x: number,
    y: number,
    isShiftPressed: boolean
  ): fabric.Object;

  /**
   * Abstract method to be implemented by concrete constrained shape tools.
   * This method should update the dimensions/position of the shape during drawing.
   */
  protected abstract updateShape(
    x: number,
    y: number,
    isShiftPressed: boolean
  ): void;

  protected onMouseDown(e: MouseEvent): void {
    if (!e.e) return; // Ensure e.e is not undefined

    const pointer = this.canvas.getPointer(e.e);
    this.startX = pointer.x;
    this.startY = pointer.y;
    this._isDrawing = true;

    // Disable canvas selection during drawing
    this.canvas.selection = false;

    const isShiftPressed = (e.e as globalThis.MouseEvent).shiftKey;
    this.currentShape = this.createShape(
      this.startX,
      this.startY,
      isShiftPressed
    );

    if (this.currentShape) {
      this.canvas.add(this.currentShape);
    }
  }

  protected onMouseMove(e: MouseEvent): void {
    if (!this._isDrawing || !this.currentShape || !e.e) return; // Ensure e.e is not undefined

    const pointer = this.canvas.getPointer(e.e);
    const x = pointer.x;
    const y = pointer.y;
    const isShiftPressed = (e.e as globalThis.MouseEvent).shiftKey;

    this.updateShape(x, y, isShiftPressed);
    this.canvas.renderAll();
  }

  protected onMouseUp(e: MouseEvent): void {
    if (!this._isDrawing || !this.currentShape) return;

    // Re-enable canvas selection
    this.canvas.selection = true;

    // Finalize the shape
    this.finalizeShape(this.currentShape);
    this.notifyComplete();
  }
}
