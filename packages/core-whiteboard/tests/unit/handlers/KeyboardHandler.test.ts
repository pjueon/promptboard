/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fabric } from 'fabric';
import { KeyboardHandler } from '../../../src/handlers/KeyboardHandler';
import { CanvasManager } from '../../../src/core/CanvasManager';
import { HistoryManager } from '../../../src/core/HistoryManager';
import { ToolManager } from '../../../src/core/ToolManager';

describe('KeyboardHandler', () => {
  let keyboardHandler: KeyboardHandler;
  let canvasManager: CanvasManager;
  let historyManager: HistoryManager;
  let toolManager: ToolManager;
  let canvas: fabric.Canvas;
  let config: any;

  beforeEach(() => {
    // Mock canvas
    canvas = new fabric.Canvas(null);
    vi.spyOn(canvas, 'getActiveObject').mockReturnValue(null);
    vi.spyOn(canvas, 'discardActiveObject').mockReturnValue(canvas);
    vi.spyOn(canvas, 'renderAll').mockReturnValue(canvas);
    vi.spyOn(canvas, 'remove').mockReturnValue(canvas);

    // Mock CanvasManager
    canvasManager = {
      getCanvas: vi.fn().mockReturnValue(canvas),
    } as any;

    // Mock HistoryManager
    historyManager = {
      undo: vi.fn(),
      redo: vi.fn(),
      saveSnapshot: vi.fn(),
    } as any;

    // Mock ToolManager
    toolManager = {
      getActiveTool: vi.fn().mockReturnValue(null),
    } as any;

    config = {
      onSave: vi.fn(),
      onCopy: vi.fn(),
      onDelete: vi.fn(),
      onBrushSizeChange: vi.fn(),
    };

    keyboardHandler = new KeyboardHandler(
      canvasManager,
      historyManager,
      toolManager,
      config
    );
    keyboardHandler.attach();
  });

  afterEach(() => {
    keyboardHandler.detach();
  });

  it('should handle Ctrl+Z for undo', () => {
    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true });
    vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);

    expect(historyManager.undo).toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('should handle Ctrl+Shift+Z for redo', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      shiftKey: true,
    });
    vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);

    expect(historyManager.redo).toHaveBeenCalled();
  });

  it('should handle Ctrl+Y for redo', () => {
    const event = new KeyboardEvent('keydown', { key: 'y', ctrlKey: true });
    vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);

    expect(historyManager.redo).toHaveBeenCalled();
  });

  it('should handle Ctrl+S for save', () => {
    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);

    expect(config.onSave).toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('should handle [ and ] for brush size', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '[' }));
    expect(config.onBrushSizeChange).toHaveBeenCalledWith(-1);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: ']' }));
    expect(config.onBrushSizeChange).toHaveBeenCalledWith(1);
  });

  it('should ignore brush size keys when editing text', () => {
    const activeText = { type: 'i-text', isEditing: true } as fabric.IText;
    vi.spyOn(canvas, 'getActiveObject').mockReturnValue(activeText);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '[' }));
    expect(config.onBrushSizeChange).not.toHaveBeenCalled();
  });

  it('should handle Delete key with custom handler', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
    expect(config.onDelete).toHaveBeenCalled();
  });

  it('should handle Escape to deselect', () => {
    const activeObject = { type: 'rect' } as fabric.Object;
    vi.spyOn(canvas, 'getActiveObject').mockReturnValue(activeObject);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    
    expect(canvas.discardActiveObject).toHaveBeenCalled();
    expect(canvas.renderAll).toHaveBeenCalled();
  });
});
