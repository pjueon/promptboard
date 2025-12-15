import { fabric } from 'fabric';
import { CanvasManager } from '../core/CanvasManager';
import { HistoryManager } from '../core/HistoryManager';
import { ToolManager } from '../core/ToolManager';
import { SelectTool } from '../tools/SelectTool';

export interface KeyboardHandlerConfig {
  onSave?: () => void;
  onBrushSizeChange?: (delta: number) => void;
  onCopy?: () => void; // Custom copy handler (e.g. for region copy)
  onDelete?: () => void; // Custom delete handler
}

export class KeyboardHandler {
  private canvasManager: CanvasManager;
  private historyManager: HistoryManager;
  private toolManager: ToolManager;
  private config: KeyboardHandlerConfig;
  private _boundKeydownHandler: (e: KeyboardEvent) => void;

  constructor(
    canvasManager: CanvasManager,
    historyManager: HistoryManager,
    toolManager: ToolManager,
    config: KeyboardHandlerConfig = {}
  ) {
    this.canvasManager = canvasManager;
    this.historyManager = historyManager;
    this.toolManager = toolManager;
    this.config = config;
    this._boundKeydownHandler = this.handleKeydown.bind(this);
  }

  attach(): void {
    document.addEventListener('keydown', this._boundKeydownHandler);
  }

  detach(): void {
    document.removeEventListener('keydown', this._boundKeydownHandler);
  }

  private handleKeydown(e: KeyboardEvent): void {
    const canvas = this.canvasManager.getCanvas();
    if (!canvas) return;

    // Check if user is editing text
    const activeObject = canvas.getActiveObject();
    const isEditingText =
      activeObject &&
      activeObject.type === 'i-text' &&
      (activeObject as fabric.IText).isEditing;

    if (isEditingText) return;

    // [ - Decrease stroke width
    if (e.key === '[') {
      if (this.config.onBrushSizeChange) {
        this.config.onBrushSizeChange(-1);
      }
      return;
    }

    // ] - Increase stroke width
    if (e.key === ']') {
      if (this.config.onBrushSizeChange) {
        this.config.onBrushSizeChange(1);
      }
      return;
    }

    // ESC - Cancel selection / Deselect
    if (e.key === 'Escape') {
      // Check if SelectTool has selection rect
      const activeTool = this.toolManager.getActiveTool();
      if (activeTool instanceof SelectTool) {
        const selectionRect = activeTool.getSelectionRect();
        if (selectionRect) {
          activeTool.removeSelectionRect();
          canvas.renderAll();
          return;
        }
      }

      // Deselect active object if exists
      if (activeObject) {
        canvas.discardActiveObject();
        canvas.renderAll();
        return;
      }
    }

    // Ctrl+C - Copy
    if (e.ctrlKey && e.key === 'c') {
      if (this.config.onCopy) {
        // If custom copy handler provided (e.g. for region copy), use it
        // The implementation can check conditions
        this.config.onCopy();
        return;
      }
    }

    // Delete key
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.config.onDelete) {
            this.config.onDelete();
        } else {
            this.handleDefaultDelete(canvas);
        }
    }

    // Ctrl+S - Save
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      if (this.config.onSave) {
        this.config.onSave();
      }
    }

    // Ctrl+Z - Undo
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.historyManager.undo();
    }

    // Ctrl+Shift+Z or Ctrl+Y - Redo
    if (
      (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') ||
      (e.ctrlKey && e.key === 'y')
    ) {
      e.preventDefault();
      this.historyManager.redo();
    }
  }

  private handleDefaultDelete(canvas: fabric.Canvas): void {
      const activeObject = canvas.getActiveObject();
      if (!activeObject) return;
    
      if (activeObject.type === 'activeSelection') {
        // Handle group selection
        (activeObject as fabric.ActiveSelection).getObjects().forEach(obj => {
          // @ts-expect-error - custom prop
          const associatedHead = obj.arrowHead;
          canvas.remove(obj);
          if (associatedHead) {
            canvas.remove(associatedHead);
          }
        });
      } else {
        // Handle single object selection
        // @ts-expect-error - custom prop
        const associatedHead = activeObject.arrowHead;
        canvas.remove(activeObject);
        if (associatedHead) {
          canvas.remove(associatedHead);
        }
      }
    
      canvas.discardActiveObject();
      canvas.renderAll();
      this.historyManager.saveSnapshot();
  }
}
