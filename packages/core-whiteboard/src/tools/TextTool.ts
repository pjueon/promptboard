import { fabric } from 'fabric';
import { Tool } from './base/Tool';
import type { ToolConfig, MouseEvent } from '../types/index';

/**
 * Text tool for creating editable text objects
 * Unlike drawing tools, this is click-based (no drag required)
 */
export class TextTool extends Tool {
  private mouseDownHandler: ((e: MouseEvent) => void) | null = null;

  constructor(
    canvas: fabric.Canvas,
    config: ToolConfig,
    onSnapshotSave?: () => void,
    onComplete?: () => void
  ) {
    super(canvas, config, onSnapshotSave, onComplete);
  }

  /**
   * Activate the text tool
   */
  activate(): void {
    this.setupEventHandlers();
  }

  /**
   * Deactivate the text tool
   */
  deactivate(): void {
    this.cleanup();
  }

  /**
   * Text tool is never in a "drawing" state (it's click-based)
   */
  isDrawing(): boolean {
    return false;
  }

  /**
   * Update config and apply fontSize to selected text if applicable
   */
  updateConfig(config: ToolConfig): void {
    super.updateConfig(config);

    // If a text object is currently selected and being edited, update its fontSize
    const activeObject = this.canvas.getActiveObject();
    if (activeObject && activeObject.type === 'i-text' && config.fontSize) {
      const itext = activeObject as fabric.IText;
      itext.set('fontSize', config.fontSize);
      itext.setCoords();
      this.canvas.renderAll();
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.mouseDownHandler = (e: MouseEvent) => this.onMouseDown(e);
    this.canvas.on('mouse:down', this.mouseDownHandler as any);
  }

  /**
   * Handle mouse down - create text at click position
   */
  private onMouseDown(e: MouseEvent): void {
    const pointer = e.pointer;
    if (!pointer) return;

    // Create editable text at click position
    const text = new fabric.IText('', {
      left: pointer.x,
      top: pointer.y,
      fill: this.config.color,
      fontSize: this.config.fontSize || 20,
      fontFamily: 'Arial',
    });

    // Add to canvas
    this.canvas.add(text);
    this.canvas.setActiveObject(text);

    // Enter editing mode immediately
    text.enterEditing();
    text.setCoords();

    // Save snapshot when editing exits
    text.on('editing:exited', () => {
      // Use setTimeout to ensure the text is finalized before saving
      setTimeout(() => {
        this.saveSnapshot();
      }, 100);
    });

    this.canvas.renderAll();

    // Note: We don't call notifyComplete() here because the user
    // should manually switch tools when done typing
  }

  /**
   * Clean up event listeners
   */
  private cleanup(): void {
    if (this.mouseDownHandler) {
      this.canvas.off('mouse:down', this.mouseDownHandler as any);
      this.mouseDownHandler = null;
    }
  }
}
