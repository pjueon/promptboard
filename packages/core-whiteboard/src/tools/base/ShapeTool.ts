import type { fabric } from 'fabric';
import { Tool } from './Tool';
import type { ToolConfig, MouseEvent } from '../../types/index';

/**
 * Base class for shape drawing tools
 * Handles common mouse event patterns and drawing state
 */
export abstract class ShapeTool extends Tool {
  protected _isDrawing = false;
  protected startX = 0;
  protected startY = 0;
  protected currentShape: fabric.Object | null = null;

  protected mouseDownHandler: ((e: MouseEvent) => void) | null = null;
  protected mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  protected mouseUpHandler: ((e: MouseEvent) => void) | null = null;

  constructor(
    canvas: fabric.Canvas,
    config: ToolConfig,
    onSnapshotSave?: () => void,
    onComplete?: () => void
  ) {
    super(canvas, config, onSnapshotSave, onComplete);
  }

  /**
   * Setup event handlers for drawing
   */
  protected abstract setupEventHandlers(): void;

  /**
   * Handle mouse down event
   */
  protected abstract onMouseDown(e: MouseEvent): void;

  /**
   * Handle mouse move event
   */
  protected abstract onMouseMove(e: MouseEvent): void;

  /**
   * Handle mouse up event
   */
  protected abstract onMouseUp(e: MouseEvent): void;

  /**
   * Activate the tool
   */
  activate(): void {
    // Make all existing objects non-selectable when switching to drawing tool
    this.canvas.getObjects().forEach(obj => {
      obj.set({
        selectable: false,
        evented: false
      });
    });

    // Discard any active selection
    this.canvas.discardActiveObject();
    this.canvas.renderAll();

    this.setupEventHandlers();
  }

  /**
   * Deactivate the tool and cleanup
   */
  deactivate(): void {
    this.cleanup();
  }

  /**
   * Check if the tool is currently in a drawing state
   */
  isDrawing(): boolean {
    return this._isDrawing;
  }

  /**
   * Clean up event listeners and temporary objects
   */
  protected cleanup(): void {
    if (this.mouseDownHandler) {
      this.canvas.off('mouse:down', this.mouseDownHandler as any);
      this.mouseDownHandler = null;
    }
    if (this.mouseMoveHandler) {
      this.canvas.off('mouse:move', this.mouseMoveHandler as any);
      this.mouseMoveHandler = null;
    }
    if (this.mouseUpHandler) {
      this.canvas.off('mouse:up', this.mouseUpHandler as any);
      this.mouseUpHandler = null;
    }

    // Reset drawing state
    this._isDrawing = false;
    this.currentShape = null;
  }

  /**
   * Finalize shape after drawing
   * Makes it selectable and saves snapshot
   */
  protected finalizeShape(
    shape: fabric.Object,
    switchToSelect = true
  ): void {
    shape.set({
      selectable: true,
      evented: true,
    });
    shape.setCoords();

    // Select the newly created shape
    this.canvas.setActiveObject(shape);

    // Save snapshot after a small delay
    setTimeout(() => {
      this.saveSnapshot();
    }, 50);

    this._isDrawing = false;
    this.currentShape = null;
    this.canvas.renderAll();
  }
}
