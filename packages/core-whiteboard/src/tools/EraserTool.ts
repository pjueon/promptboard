import { fabric } from 'fabric';
import { Tool } from './base/Tool';
import type { ToolConfig } from '../types/index';

/**
 * Eraser tool using Fabric.js free drawing mode with white color
 * This tool doesn't use mouse event handlers - it relies on Fabric's built-in drawing mode
 */
export class EraserTool extends Tool {
  constructor(
    canvas: fabric.Canvas,
    config: ToolConfig,
    onSnapshotSave?: () => void,
    onComplete?: () => void
  ) {
    super(canvas, config, onSnapshotSave, onComplete);
  }

  /**
   * Activate the eraser tool
   */
  activate(): void {
    // Enable Fabric.js free drawing mode
    this.canvas.isDrawingMode = true;
    this.canvas.selection = false;

    // Set white color for eraser (Paint-style eraser)
    if (this.canvas.freeDrawingBrush) {
      this.canvas.freeDrawingBrush.color = '#ffffff';
      this.canvas.freeDrawingBrush.width = this.config.strokeWidth;
    }

    // Set eraser cursor
    const eraserCursor = this.getEraserCursor();
    this.canvas.freeDrawingCursor = eraserCursor;
    this.canvas.defaultCursor = eraserCursor;
    this.canvas.hoverCursor = eraserCursor;

    // Immediately update the DOM cursor (without waiting for mouse move)
    const upperCanvasEl = (this.canvas as any).upperCanvasEl as HTMLCanvasElement | undefined;
    if (upperCanvasEl) {
      upperCanvasEl.style.cursor = eraserCursor;
    }
  }

  /**
   * Deactivate the eraser tool
   */
  deactivate(): void {
    // Disable free drawing mode
    this.canvas.isDrawingMode = false;
    this.canvas.selection = true;

    // Reset brush color to normal (in case it's needed)
    if (this.canvas.freeDrawingBrush) {
      this.canvas.freeDrawingBrush.color = this.config.color;
    }
  }

  /**
   * Eraser tool uses Fabric's drawing mode, so we don't track drawing state
   */
  isDrawing(): boolean {
    return false;
  }

  /**
   * Update eraser brush width when config changes
   */
  updateConfig(config: ToolConfig): void {
    super.updateConfig(config);

    // Update brush width if eraser is active
    if (this.canvas.isDrawingMode && this.canvas.freeDrawingBrush) {
      this.canvas.freeDrawingBrush.width = config.strokeWidth;

      // Update cursor size
      const eraserCursor = this.getEraserCursor();
      this.canvas.freeDrawingCursor = eraserCursor;
      this.canvas.defaultCursor = eraserCursor;
      this.canvas.hoverCursor = eraserCursor;

      // Immediately update the DOM cursor (without waiting for mouse move)
      const upperCanvasEl = (this.canvas as any).upperCanvasEl as HTMLCanvasElement | undefined;
      if (upperCanvasEl) {
        upperCanvasEl.style.cursor = eraserCursor;
      }
    }
  }

  /**
   * Generate eraser cursor SVG with dynamic size
   */
  private getEraserCursor(): string {
    const size = Math.max(8, Math.min(this.config.strokeWidth * 2, 48)); // Min 8px, Max 48px
    const halfSize = size / 2;
    const svgSize = size + 4; // Add border space
    const halfSvgSize = svgSize / 2;

    // Create SVG with circle representing eraser size
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}">
      <circle cx="${halfSvgSize}" cy="${halfSvgSize}" r="${halfSize}" fill="white" stroke="black" stroke-width="1" opacity="0.8"/>
    </svg>`;

    const encodedSvg = encodeURIComponent(svg);
    return `url('data:image/svg+xml;utf8,${encodedSvg}') ${halfSvgSize} ${halfSvgSize}, auto`;
  }
}
