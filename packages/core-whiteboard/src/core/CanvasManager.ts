import { fabric } from 'fabric';
import type { CanvasState } from '../types/index';

/**
 * Configuration options for CanvasManager
 */
export interface CanvasManagerConfig {
  width: number;
  height: number;
  backgroundColor?: string;
}

/**
 * Manages the Fabric.js canvas instance
 * Handles initialization, resizing, and basic canvas operations
 */
export class CanvasManager {
  private canvas: fabric.Canvas;

  constructor(canvasElement: HTMLCanvasElement, config: CanvasManagerConfig) {
    this.canvas = new fabric.Canvas(canvasElement, {
      width: config.width,
      height: config.height,
      backgroundColor: config.backgroundColor || '#ffffff',
      isDrawingMode: false,
      targetFindTolerance: 10,
      perPixelTargetFind: true,
      uniformScaling: false,
      hoverCursor: 'move',
      moveCursor: 'move',
    });

    // Set willReadFrequently on internal canvases to suppress warnings
    this.setupCanvasContexts();
  }

  /**
   * Get the underlying Fabric.js canvas instance
   */
  getCanvas(): fabric.Canvas {
    return this.canvas;
  }

  /**
   * Resize the canvas
   */
  resize(width: number, height: number): void {
    this.canvas.setDimensions({ width, height });
    this.canvas.renderAll();
  }

  /**
   * Clear all objects from canvas
   */
  clear(): void {
    this.canvas.clear();
    this.canvas.backgroundColor = '#ffffff';
    this.canvas.renderAll();
  }

  /**
   * Export canvas to JSON
   */
  toJSON(propertiesToInclude?: string[]): CanvasState {
    return this.canvas.toJSON(propertiesToInclude) as CanvasState;
  }

  /**
   * Load canvas from JSON
   */
  loadFromJSON(
    state: CanvasState,
    callback?: () => void
  ): void {
    this.canvas.loadFromJSON(state, () => {
      this.canvas.renderAll();
      callback?.();
    });
  }

  /**
   * Export canvas as data URL
   */
  toDataURL(format: 'png' | 'jpeg' = 'png', quality = 1): string {
    return this.canvas.toDataURL({
      format,
      quality,
    });
  }

  /**
   * Render the canvas
   */
  render(): void {
    this.canvas.renderAll();
  }

  /**
   * Dispose of the canvas
   */
  dispose(): void {
    this.canvas.dispose();
  }

  /**
   * Setup canvas contexts with willReadFrequently flag
   * This suppresses performance warnings when reading pixels frequently
   */
  private setupCanvasContexts(): void {
    try {
      const lowerCanvas = (this.canvas as fabric.Canvas & {
        lowerCanvasEl?: HTMLCanvasElement;
      }).lowerCanvasEl;
      const upperCanvas = (this.canvas as fabric.Canvas & {
        upperCanvasEl?: HTMLCanvasElement;
      }).upperCanvasEl;

      if (lowerCanvas) {
        lowerCanvas.getContext('2d', { willReadFrequently: true });
      }
      if (upperCanvas) {
        upperCanvas.getContext('2d', { willReadFrequently: true });
      }
    } catch {
      // Ignore if context already created
    }
  }
}
