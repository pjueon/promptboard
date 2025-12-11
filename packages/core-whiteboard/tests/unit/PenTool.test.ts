import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fabric } from 'fabric';
import { PenTool } from '../../src/tools/PenTool';
import { ToolConfig } from '../../src/types';

describe('PenTool', () => {
  let canvas: fabric.Canvas;
  let penTool: PenTool;
  let config: ToolConfig;

  beforeEach(() => {
    // Mock canvas
    canvas = new fabric.Canvas(null);

    // Mock freeDrawingBrush
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);

    vi.spyOn(canvas, 'renderAll').mockImplementation(() => {});

    config = { color: 'black', strokeWidth: 10 };
    penTool = new PenTool(canvas, config);
  });

  it('should be instantiated', () => {
    expect(penTool).toBeInstanceOf(PenTool);
  });

  it('should return false for isDrawing()', () => {
    // Pen tool uses Fabric's drawing mode, doesn't track drawing state
    expect(penTool.isDrawing()).toBe(false);
  });

  it('should enable drawing mode on activate', () => {
    penTool.activate();

    expect(canvas.isDrawingMode).toBe(true);
    expect(canvas.selection).toBe(false);
  });

  it('should set brush color to config color on activate', () => {
    penTool.activate();

    expect(canvas.freeDrawingBrush?.color).toBe('black');
  });

  it('should set brush width to strokeWidth on activate', () => {
    penTool.activate();

    expect(canvas.freeDrawingBrush?.width).toBe(10);
  });

  it('should set crosshair cursor on activate', () => {
    penTool.activate();

    expect(canvas.freeDrawingCursor).toBe('crosshair');
    expect(canvas.defaultCursor).toBe('crosshair');
    expect(canvas.hoverCursor).toBe('crosshair');
  });

  it('should disable drawing mode on deactivate', () => {
    penTool.activate();
    penTool.deactivate();

    expect(canvas.isDrawingMode).toBe(false);
    expect(canvas.selection).toBe(true);
  });

  it('should update brush color when config changes', () => {
    penTool.activate();

    // Update config
    const newConfig: ToolConfig = { color: 'red', strokeWidth: 20 };
    penTool.updateConfig(newConfig);

    expect(canvas.freeDrawingBrush?.color).toBe('red');
  });

  it('should update brush width when config changes', () => {
    penTool.activate();

    // Update config
    const newConfig: ToolConfig = { color: 'red', strokeWidth: 20 };
    penTool.updateConfig(newConfig);

    expect(canvas.freeDrawingBrush?.width).toBe(20);
  });

  it('should not update brush when deactivated', () => {
    // Don't activate
    const initialWidth = canvas.freeDrawingBrush?.width;
    const initialColor = canvas.freeDrawingBrush?.color;

    // Update config while deactivated
    const newConfig: ToolConfig = { color: 'red', strokeWidth: 50 };
    penTool.updateConfig(newConfig);

    // Brush settings should not change because tool is not active (isDrawingMode = false)
    expect(canvas.freeDrawingBrush?.width).toBe(initialWidth);
    expect(canvas.freeDrawingBrush?.color).toBe(initialColor);
  });

  it('should use different colors for different instances', () => {
    const redConfig: ToolConfig = { color: 'red', strokeWidth: 5 };
    const redPenTool = new PenTool(canvas, redConfig);
    redPenTool.activate();

    expect(canvas.freeDrawingBrush?.color).toBe('red');

    redPenTool.deactivate();

    const bluConfig: ToolConfig = { color: 'blue', strokeWidth: 5 };
    const bluePenTool = new PenTool(canvas, bluConfig);
    bluePenTool.activate();

    expect(canvas.freeDrawingBrush?.color).toBe('blue');
  });

  it('should maintain crosshair cursor after config update', () => {
    penTool.activate();

    // Update config
    const newConfig: ToolConfig = { color: 'green', strokeWidth: 15 };
    penTool.updateConfig(newConfig);

    // Cursor should still be crosshair (doesn't change with config)
    expect(canvas.freeDrawingCursor).toBe('crosshair');
    expect(canvas.defaultCursor).toBe('crosshair');
    expect(canvas.hoverCursor).toBe('crosshair');
  });
});
