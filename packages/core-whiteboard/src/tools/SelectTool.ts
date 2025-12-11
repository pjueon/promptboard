import { fabric } from 'fabric';
import { Tool } from './base/Tool';
import type { ToolConfig, MouseEvent } from '../types/index';

/**
 * Region selection tool - Paint-style area selection
 * Draws a dashed rectangle to select a region for copying/cutting
 */
export class SelectTool extends Tool {
  private mouseDownHandler: ((e: MouseEvent) => void) | null = null;
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private mouseUpHandler: ((e: MouseEvent) => void) | null = null;
  private selectionRect: fabric.Rect | null = null;
  private _isDrawing = false;
  private startX = 0;
  private startY = 0;

  constructor(
    canvas: fabric.Canvas,
    config: ToolConfig,
    onSnapshotSave?: () => void,
    onComplete?: () => void
  ) {
    super(canvas, config, onSnapshotSave, onComplete);
  }

  /**
   * Activate the select tool
   */
  activate(): void {
    this.cleanup(); // Clean up any existing state
    this.canvas.selection = true; // Enable object selection
    this.setupEventHandlers();
  }

  /**
   * Deactivate the select tool
   */
  deactivate(): void {
    this.cleanup();
  }

  /**
   * Check if currently drawing a selection rectangle
   */
  isDrawing(): boolean {
    return this._isDrawing;
  }

  /**
   * Get the current selection rectangle (for external use like copying)
   */
  getSelectionRect(): fabric.Rect | null {
    return this.selectionRect;
  }

  /**
   * Remove the selection rectangle from canvas
   */
  removeSelectionRect(): void {
    if (this.selectionRect) {
      this.canvas.remove(this.selectionRect);
      this.selectionRect = null;
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.mouseDownHandler = (e: MouseEvent) => this.onMouseDown(e);
    this.mouseMoveHandler = (e: MouseEvent) => this.onMouseMove(e);
    this.mouseUpHandler = (e: MouseEvent) => this.onMouseUp(e);

    this.canvas.on('mouse:down', this.mouseDownHandler as any);
    this.canvas.on('mouse:move', this.mouseMoveHandler as any);
    this.canvas.on('mouse:up', this.mouseUpHandler as any);
  }

  /**
   * Handle mouse down - start region selection if clicking on empty space
   */
  private onMouseDown(e: MouseEvent): void {
    // Check if clicking on an existing object
    if (e.target) {
      // Clicked on an object, allow normal selection
      return;
    }

    // Clicked on empty space, start region selection
    const pointer = e.pointer;
    if (!pointer) return;

    this._isDrawing = true;
    this.startX = pointer.x;
    this.startY = pointer.y;

    // Remove previous selection rectangle if exists
    if (this.selectionRect) {
      this.canvas.remove(this.selectionRect);
      this.selectionRect = null;
    }

    // Disable object selection during region drawing
    this.canvas.selection = false;
    this.canvas.discardActiveObject();

    // Create selection rectangle with dashed border
    this.selectionRect = new fabric.Rect({
      left: this.startX,
      top: this.startY,
      width: 0,
      height: 0,
      fill: 'rgba(0, 0, 0, 0)', // Transparent fill
      stroke: '#000000',
      strokeWidth: 1,
      strokeDashArray: [5, 5], // Dashed line
      selectable: false,
      evented: false,
    });

    this.canvas.add(this.selectionRect);
  }

  /**
   * Handle mouse move - update selection rectangle size
   */
  private onMouseMove(e: MouseEvent): void {
    if (!this._isDrawing || !this.selectionRect) return;

    const pointer = e.pointer;
    if (!pointer) return;

    const width = pointer.x - this.startX;
    const height = pointer.y - this.startY;

    // Handle negative dimensions (dragging left or up)
    this.selectionRect.set({
      left: width < 0 ? pointer.x : this.startX,
      top: height < 0 ? pointer.y : this.startY,
      width: Math.abs(width),
      height: Math.abs(height),
    });

    this.canvas.renderAll();
  }

  /**
   * Handle mouse up - finish region selection
   */
  private onMouseUp(e: MouseEvent): void {
    if (!this._isDrawing) return;

    this._isDrawing = false;

    // Re-enable object selection after region drawing
    this.canvas.selection = true;

    // Keep selection rectangle on canvas for copying/cutting
    // User will manually clear it by switching tools or pressing Delete
  }

  /**
   * Clean up event listeners and state
   */
  private cleanup(): void {
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

    // Remove selection rectangle when switching tools
    this.removeSelectionRect();
  }
}
