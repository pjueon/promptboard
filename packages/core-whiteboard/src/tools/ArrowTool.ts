import { fabric } from 'fabric';
import { ShapeTool } from './base/ShapeTool';
import type { ToolConfig, MouseEvent } from '../types/index';
import { EditableLine } from '../fabric-objects/EditableLine';

/**
 * Arrow drawing tool
 * Draws arrows (line + triangle head) with optional angle snapping (Shift key)
 */
export class ArrowTool extends ShapeTool {
  private currentArrowHead: fabric.Triangle | null = null;

  constructor(
    canvas: fabric.Canvas,
    config: ToolConfig,
    onSnapshotSave?: () => void,
    onComplete?: () => void
  ) {
    super(canvas, config, onSnapshotSave, onComplete);
  }

  /**
   * Setup event handlers
   */
  protected setupEventHandlers(): void {
    this.mouseDownHandler = (e: MouseEvent) => this.onMouseDown(e);
    this.mouseMoveHandler = (e: MouseEvent) => this.onMouseMove(e);
    this.mouseUpHandler = (e: MouseEvent) => this.onMouseUp(e);

    this.canvas.on('mouse:down', this.mouseDownHandler as any);
    this.canvas.on('mouse:move', this.mouseMoveHandler as any);
    this.canvas.on('mouse:up', this.mouseUpHandler as any);
  }

  /**
   * Handle mouse down - start drawing arrow
   */
  protected onMouseDown(e: MouseEvent): void {
    const pointer = e.pointer;
    if (!pointer) return;

    this._isDrawing = true;
    this.startX = pointer.x;
    this.startY = pointer.y;

    // Disable canvas selection during drawing
    this.canvas.selection = false;

    // Create EditableLine (arrow shaft)
    this.currentShape = new EditableLine(
      [this.startX, this.startY, this.startX, this.startY],
      {
        stroke: this.config.color,
        strokeWidth: this.config.strokeWidth,
        selectable: false,
        evented: false,
        perPixelTargetFind: true,
        strokeUniform: true,
        originX: 'center',
        originY: 'center',
        type: 'editableLine',
      }
    );

    // Calculate arrow head size based on stroke width
    const headSize = Math.max(15, this.config.strokeWidth * 3);

    // Create Triangle (arrow head)
    this.currentArrowHead = new fabric.Triangle({
      left: this.startX,
      top: this.startY,
      width: headSize,
      height: headSize,
      fill: this.config.color,
      selectable: false,
      evented: false,
      hasBorders: false,
      hasControls: false,
      originX: 'center',
      originY: 'center',
      angle: 0,
    });

    if (this.currentShape && this.currentArrowHead) {
      this.canvas.add(this.currentShape);
      this.canvas.add(this.currentArrowHead);
    }
  }

  /**
   * Handle mouse move - update arrow endpoint and head
   */
  protected onMouseMove(e: MouseEvent): void {
    if (!this._isDrawing || !this.currentShape || !this.currentArrowHead) return;

    const pointer = e.pointer;
    if (!pointer) return;

    let targetX = pointer.x;
    let targetY = pointer.y;

    // Snap to 45 degrees if Shift is pressed
    if (e.e && (e.e as KeyboardEvent).shiftKey) {
      const dx = targetX - this.startX;
      const dy = targetY - this.startY;

      if (dx !== 0 || dy !== 0) {
        const angle = Math.atan2(dy, dx);
        const length = Math.sqrt(dx * dx + dy * dy);

        // Snap to 45 degrees (PI/4)
        const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);

        targetX = this.startX + length * Math.cos(snapAngle);
        targetY = this.startY + length * Math.sin(snapAngle);
      }
    }

    // Update line endpoint
    (this.currentShape as fabric.Line).set({
      x2: targetX,
      y2: targetY,
    });
    (this.currentShape as fabric.Line).setCoords();

    // Calculate arrow head position and angle
    const dx = targetX - this.startX;
    const dy = targetY - this.startY;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI); // Convert to degrees

    // Position triangle at the end of the line
    this.currentArrowHead.set({
      left: targetX,
      top: targetY,
      angle: angle + 90, // Rotate 90 degrees because Triangle points upward by default
    });
    this.currentArrowHead.setCoords();

    this.canvas.renderAll();
  }

  /**
   * Handle mouse up - finalize arrow
   */
  protected onMouseUp(e: MouseEvent): void {
    if (!this._isDrawing || !this.currentShape || !this.currentArrowHead) return;

    // Re-enable canvas selection
    this.canvas.selection = true;

    // Link line and triangle with custom data
    const arrowLine = this.currentShape as fabric.Line;
    const arrowHead = this.currentArrowHead;

    // Generate unique ID for this arrow pair
    const arrowId = `arrow_${Date.now()}_${Math.random()}`;

    // Link line and triangle with custom data
    // @ts-expect-error - adding custom property
    arrowLine.arrowId = arrowId;
    // @ts-expect-error - adding custom property
    arrowLine.arrowHead = arrowHead;
    // @ts-expect-error - adding custom property
    arrowHead.arrowId = arrowId;
    // @ts-expect-error - adding custom property
    arrowHead.arrowLine = arrowLine;

    // Make line selectable but keep triangle non-selectable
    arrowLine.set({
      selectable: true,
      evented: true,
    });

    // Triangle should not be selectable (it follows the line)
    arrowHead.set({
      selectable: false,
      evented: false,
      hasBorders: false,
      hasControls: false,
    });

    arrowLine.setCoords();
    arrowHead.setCoords();

    // Add event listeners to line for modifications
    const updateHandler = () => {
      this.updateArrowHead(arrowLine, arrowHead);
      this.canvas.renderAll();
    };

    arrowLine.on('moving', updateHandler);
    arrowLine.on('scaling', updateHandler);
    arrowLine.on('rotating', updateHandler);
    arrowLine.on('modified', updateHandler);

    // Select the line
    this.canvas.setActiveObject(arrowLine);

    // Save snapshot
    setTimeout(() => {
      this.saveSnapshot();
    }, 50);

    this._isDrawing = false;
    this.currentShape = null;
    this.currentArrowHead = null;

    this.canvas.renderAll();

    // Notify that drawing is complete
    this.notifyComplete();
  }

  /**
   * Update arrow head position and angle based on line coordinates
   */
  private updateArrowHead(line: fabric.Line, triangle: fabric.Triangle): void {
    if (!line || !triangle) return;

    // Use calcLinePoints to get the actual transformed coordinates of the line endpoints
    // This properly handles all transformations including negative scaling
    const point1 = line.calcLinePoints();

    // Get transformation matrix to transform local coordinates to canvas coordinates
    const transform = line.calcTransformMatrix();

    // Transform the line endpoints using the transformation matrix
    const transformPoint = (x: number, y: number) => {
      return fabric.util.transformPoint(
        new fabric.Point(x, y),
        transform
      );
    };

    const start = transformPoint(point1.x1, point1.y1);
    const end = transformPoint(point1.x2, point1.y2);

    // Calculate arrow angle from start to end
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const arrowAngle = Math.atan2(dy, dx) * (180 / Math.PI);

    // Update triangle position and angle (keep size constant)
    triangle.set({
      left: end.x,
      top: end.y,
      angle: arrowAngle + 90, // +90 because triangle points up by default
    });
    triangle.setCoords();
  }

  /**
   * Clean up event listeners and temporary objects
   */
  protected cleanup(): void {
    // Remove arrow head if it exists
    if (this.currentArrowHead && this.canvas) {
      this.canvas.remove(this.currentArrowHead);
      this.currentArrowHead = null;
    }

    // Call parent cleanup
    super.cleanup();
  }
}
