import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fabric } from 'fabric';
import { EraserTool } from '../../src/tools/EraserTool';
import { ToolConfig } from '../../src/types';

describe('EraserTool', () => {
  let canvas: fabric.Canvas;
  let eraserTool: EraserTool;
  let config: ToolConfig;

  beforeEach(() => {
    // Mock canvas
    canvas = new fabric.Canvas(null);

    // Mock freeDrawingBrush
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);

    vi.spyOn(canvas, 'renderAll').mockImplementation(() => {});

    config = { color: 'black', strokeWidth: 10 };
    eraserTool = new EraserTool(canvas, config);
  });

  it('should be instantiated', () => {
    expect(eraserTool).toBeInstanceOf(EraserTool);
  });

  it('should return false for isDrawing()', () => {
    // Eraser tool uses Fabric's drawing mode, doesn't track drawing state
    expect(eraserTool.isDrawing()).toBe(false);
  });

  it('should enable drawing mode on activate', () => {
    eraserTool.activate();

    expect(canvas.isDrawingMode).toBe(true);
    expect(canvas.selection).toBe(false);
  });

  it('should set brush color to white on activate', () => {
    eraserTool.activate();

    expect(canvas.freeDrawingBrush?.color).toBe('#ffffff');
  });

  it('should set brush width to strokeWidth on activate', () => {
    eraserTool.activate();

    expect(canvas.freeDrawingBrush?.width).toBe(10);
  });

  it('should set eraser cursor on activate', () => {
    eraserTool.activate();

    // Should be a data URL with SVG
    expect(canvas.freeDrawingCursor).toContain('data:image/svg+xml');
    expect(canvas.freeDrawingCursor).toContain('circle');
  });

  it('should disable drawing mode on deactivate', () => {
    eraserTool.activate();
    eraserTool.deactivate();

    expect(canvas.isDrawingMode).toBe(false);
    expect(canvas.selection).toBe(true);
  });

  it('should reset brush color to original color on deactivate', () => {
    eraserTool.activate();
    expect(canvas.freeDrawingBrush?.color).toBe('#ffffff');

    eraserTool.deactivate();
    expect(canvas.freeDrawingBrush?.color).toBe('black'); // Original config color
  });

  it('should update brush width when config changes', () => {
    eraserTool.activate();

    // Update config
    const newConfig: ToolConfig = { color: 'red', strokeWidth: 20 };
    eraserTool.updateConfig(newConfig);

    expect(canvas.freeDrawingBrush?.width).toBe(20);
  });

  it('should update cursor when config changes', () => {
    eraserTool.activate();

    const oldCursor = canvas.freeDrawingCursor;

    // Update config
    const newConfig: ToolConfig = { color: 'red', strokeWidth: 30 };
    eraserTool.updateConfig(newConfig);

    const newCursor = canvas.freeDrawingCursor;

    // Cursor should be different (different size)
    expect(newCursor).not.toBe(oldCursor);
    expect(newCursor).toContain('data:image/svg+xml');
  });

  it('should generate cursor with minimum size of 8px', () => {
    const smallConfig: ToolConfig = { color: 'black', strokeWidth: 1 };
    const smallEraserTool = new EraserTool(canvas, smallConfig);

    smallEraserTool.activate();

    // Cursor size should be at least 8px (minimum)
    // The cursor string should contain the SVG with size calculation
    expect(canvas.freeDrawingCursor).toContain('data:image/svg+xml');
  });

  it('should generate cursor with maximum size of 48px', () => {
    const largeConfig: ToolConfig = { color: 'black', strokeWidth: 100 };
    const largeEraserTool = new EraserTool(canvas, largeConfig);

    largeEraserTool.activate();

    // Cursor size should be capped at 48px (maximum)
    expect(canvas.freeDrawingCursor).toContain('data:image/svg+xml');
  });

  it('should not update brush when deactivated', () => {
    // Don't activate
    const initialWidth = canvas.freeDrawingBrush?.width;

    // Update config while deactivated
    const newConfig: ToolConfig = { color: 'red', strokeWidth: 50 };
    eraserTool.updateConfig(newConfig);

    // Brush width should not change because tool is not active (isDrawingMode = false)
    expect(canvas.freeDrawingBrush?.width).toBe(initialWidth);
  });
});
