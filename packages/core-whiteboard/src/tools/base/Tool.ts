import type { fabric } from 'fabric';
import type { ToolConfig } from '../../types/index';

/**
 * Abstract base class for all tools
 */
export abstract class Tool {
  protected canvas: fabric.Canvas;
  protected config: ToolConfig;
  protected onSnapshotSave?: () => void;
  protected onComplete?: () => void;

  constructor(
    canvas: fabric.Canvas,
    config: ToolConfig,
    onSnapshotSave?: () => void,
    onComplete?: () => void
  ) {
    this.canvas = canvas;
    this.config = config;
    this.onSnapshotSave = onSnapshotSave;
    this.onComplete = onComplete;
  }

  /**
   * Activate this tool
   */
  abstract activate(): void;

  /**
   * Deactivate this tool and clean up
   */
  abstract deactivate(): void;

  /**
   * Check if the tool is currently in a drawing state
   */
  abstract isDrawing(): boolean;

  /**
   * Update tool configuration
   */
  updateConfig(config: ToolConfig): void {
    this.config = config;
  }

  /**
   * Save a snapshot for undo/redo
   */
  protected saveSnapshot(): void {
    this.onSnapshotSave?.();
  }

  /**
   * Notify that tool operation is complete
   */
  protected notifyComplete(): void {
    this.onComplete?.();
  }
}
