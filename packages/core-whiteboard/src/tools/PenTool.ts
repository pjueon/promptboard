import { fabric } from 'fabric';
import { Tool } from './base/Tool';
import type { ToolConfig } from '../types/index';

/**
 * Pen tool using Fabric.js free drawing mode
 * This tool doesn't use mouse event handlers - it relies on Fabric's built-in drawing mode
 */
export class PenTool extends Tool {
  constructor(
    canvas: fabric.Canvas,
    config: ToolConfig,
    onSnapshotSave?: () => void,
    onComplete?: () => void
  ) {
    super(canvas, config, onSnapshotSave, onComplete);
  }

  /**
   * Activate the pen tool
   */
  activate(): void {
    // Enable Fabric.js free drawing mode
    this.canvas.isDrawingMode = true;
    this.canvas.selection = false;

    // Set pen color and width from config
    if (this.canvas.freeDrawingBrush) {
      this.canvas.freeDrawingBrush.color = this.config.color;
      this.canvas.freeDrawingBrush.width = this.config.strokeWidth;
    }

    // Set crosshair cursor
    this.canvas.freeDrawingCursor = 'crosshair';
    this.canvas.defaultCursor = 'crosshair';
    this.canvas.hoverCursor = 'crosshair';

    // Immediately update the DOM cursor (without waiting for mouse move)
    const upperCanvasEl = (this.canvas as any).upperCanvasEl as HTMLCanvasElement | undefined;
    if (upperCanvasEl) {
      upperCanvasEl.style.cursor = 'crosshair';
    }
  }

  /**
   * Deactivate the pen tool
   */
  deactivate(): void {
    // Disable free drawing mode
    this.canvas.isDrawingMode = false;
    this.canvas.selection = true;
  }

  /**
   * Pen tool uses Fabric's drawing mode, so we don't track drawing state
   */
  isDrawing(): boolean {
    return false;
  }

  /**
   * Update pen brush settings when config changes
   */
  updateConfig(config: ToolConfig): void {
    super.updateConfig(config);

    // Update brush settings if pen is active
    if (this.canvas.isDrawingMode && this.canvas.freeDrawingBrush) {
      this.canvas.freeDrawingBrush.color = config.color;
      this.canvas.freeDrawingBrush.width = config.strokeWidth;
    }
  }
}
