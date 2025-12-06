<template>
  <div class="whiteboard-container">
    <canvas
      id="whiteboard-canvas"
      ref="canvasEl"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { fabric } from 'fabric';
import { useToolbarStore } from '../stores/toolbarStore';
import { useHistoryStore } from '../stores/historyStore';
import { useToastStore } from '../stores/toastStore';
import { useAutoSaveStore } from '../stores/autoSaveStore';

interface FabricCanvasElement extends HTMLCanvasElement {
  fabric?: fabric.Canvas;
}

// Extended Fabric.js types for custom properties
interface ExtendedFabricCanvas extends fabric.Canvas {
  _resizeHandler?: () => void;
  _pasteHandler?: (e: ClipboardEvent) => void;
  _keydownHandler?: (e: KeyboardEvent) => void;
  _dragoverHandler?: (e: DragEvent) => void;
  _dropHandler?: (e: DragEvent) => void;
}

interface FabricObjectPrototype {
  controls?: {
    mtr?: {
      cursorStyleHandler?: () => string;
    };
  };
}

// Canvas element reference
const canvasEl = ref<FabricCanvasElement | null>(null);

// Fabric.js canvas instance
let fabricCanvas: ExtendedFabricCanvas | null = null;

// Shape drawing state
let isDrawing = false;
let currentShape: fabric.Object | null = null;
let startX = 0;
let startY = 0;

// Arrow drawing state (for independent Line + Triangle approach)
let currentArrowLine: fabric.Line | null = null;
let currentArrowHead: fabric.Triangle | null = null;

// Region selection state
let selectionRect: fabric.Rect | null = null;

// Mouse event handlers for shape drawing
let mouseDownHandler: ((e: fabric.IEvent<Event>) => void) | null = null;
let mouseMoveHandler: ((e: fabric.IEvent<Event>) => void) | null = null;
let mouseUpHandler: ((e: fabric.IEvent<Event>) => void) | null = null;

// Get stores
const toolbarStore = useToolbarStore();
const historyStore = useHistoryStore();
const toastStore = useToastStore();
const autoSaveStore = useAutoSaveStore();

// Auto-save cleanup function
let cleanupAutoSave: (() => void) | null = null;

// Computed eraser cursor with dynamic size
const getEraserCursor = () => {
  const size = Math.max(8, Math.min(toolbarStore.strokeWidth * 2, 48)); // Min 8px, Max 48px
  const halfSize = size / 2;
  const svgSize = size + 4; // Add border space
  const halfSvgSize = svgSize / 2;
  
  // Create SVG with circle representing eraser size
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}">
    <circle cx="${halfSvgSize}" cy="${halfSvgSize}" r="${halfSize}" fill="white" stroke="black" stroke-width="1" opacity="0.8"/>
  </svg>`;
  
  const encodedSvg = encodeURIComponent(svg);
  return `url('data:image/svg+xml;utf8,${encodedSvg}') ${halfSvgSize} ${halfSvgSize}, auto`;
};

// Update canvas cursor based on current tool
function updateCanvasCursor() {
  if (!fabricCanvas) return;
  
  const tool = toolbarStore.currentTool;
  let cursor = 'default';
  
  switch (tool) {
    case 'pen':
      cursor = 'crosshair';
      break;
    case 'line':
    case 'arrow':
    case 'rectangle':
    case 'ellipse':
      cursor = 'crosshair';
      break;
    case 'text':
      cursor = 'text';
      break;
    case 'eraser':
      cursor = getEraserCursor();
      break;
    case 'select':
      cursor = 'crosshair';
      break;
    default:
      cursor = 'default';
      break;
  }
  
  fabricCanvas.defaultCursor = cursor;
  fabricCanvas.hoverCursor = cursor;
  
  // For drawing mode (pen and eraser), also set freeDrawingCursor
  if (fabricCanvas.isDrawingMode) {
    fabricCanvas.freeDrawingCursor = cursor;
  }
  
  fabricCanvas.renderAll();
}

/**
 * Clean up shape drawing event listeners
 */
function cleanupShapeEvents() {
  if (!fabricCanvas) return;
  
  if (mouseDownHandler) {
    fabricCanvas.off('mouse:down', mouseDownHandler);
    mouseDownHandler = null;
  }
  if (mouseMoveHandler) {
    fabricCanvas.off('mouse:move', mouseMoveHandler);
    mouseMoveHandler = null;
  }
  if (mouseUpHandler) {
    fabricCanvas.off('mouse:up', mouseUpHandler);
    mouseUpHandler = null;
  }
  
  // Remove selection rectangle when switching tools
  if (selectionRect) {
    fabricCanvas.remove(selectionRect);
    selectionRect = null;
  }
}

/**
 * Setup line drawing
 */
function setupLineTool() {
  if (!fabricCanvas) return;

  cleanupShapeEvents();

  mouseDownHandler = (e: fabric.IEvent) => {    isDrawing = true;
    const pointer = e.pointer;
    startX = pointer.x;
    startY = pointer.y;
    
    // Disable canvas selection during drawing
    fabricCanvas!.selection = false;
    
    currentShape = new fabric.Line([startX, startY, startX, startY], {
      stroke: toolbarStore.color,
      strokeWidth: toolbarStore.strokeWidth,
      selectable: false,
      evented: false,
      hasBorders: false,
      hasControls: false,
      perPixelTargetFind: true,
      strokeUniform: true, // Maintain stroke width when scaling
    });
    
    fabricCanvas!.add(currentShape);
  };
  
  mouseMoveHandler = (e: fabric.IEvent) => {
    if (!isDrawing || !currentShape) return;
    
    const pointer = e.pointer;
    let targetX = pointer.x;
    let targetY = pointer.y;

    // Snap to 45 degrees if Shift is pressed
    if ((e.e as MouseEvent).shiftKey) {
      const dx = targetX - startX;
      const dy = targetY - startY;
      
      if (dx !== 0 || dy !== 0) {
        const angle = Math.atan2(dy, dx);
        const length = Math.sqrt(dx * dx + dy * dy);
        
        // Snap to 45 degrees (PI/4)
        const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
        
        targetX = startX + length * Math.cos(snapAngle);
        targetY = startY + length * Math.sin(snapAngle);
      }
    }

    (currentShape as fabric.Line).set({
      x2: targetX,
      y2: targetY,
    });
    
    fabricCanvas!.renderAll();
  };  
  mouseUpHandler = () => {
    if (!isDrawing) return;
    
    isDrawing = false;
    
    // Re-enable canvas selection
    fabricCanvas!.selection = true;
    
    if (currentShape) {
      currentShape.set({
        selectable: true,
        evented: true,
        hasBorders: true,
        hasControls: true,
      });
      currentShape.setCoords(); // Update object coordinates
      
      // Select the newly created shape
      fabricCanvas!.setActiveObject(currentShape);
    }
    currentShape = null;
    
    fabricCanvas!.renderAll(); // Re-render canvas
    
    // Switch back to select mode
    toolbarStore.setTool('select');
  };
  
  fabricCanvas.on('mouse:down', mouseDownHandler);
  fabricCanvas.on('mouse:move', mouseMoveHandler);
  fabricCanvas.on('mouse:up', mouseUpHandler);
}

/**
 * Update arrow head position and angle based on line coordinates
 */
function updateArrowHead(line: fabric.Line, triangle: fabric.Triangle) {
  if (!line || !triangle) return;

  // Get line's original coordinates (these are absolute coordinates from when line was created)
  const x1 = line.x1 || 0;
  const y1 = line.y1 || 0;
  const x2 = line.x2 || 0;
  const y2 = line.y2 || 0;

  // Calculate the original center (midpoint between x1,y1 and x2,y2)
  const origCenterX = (x1 + x2) / 2;
  const origCenterY = (y1 + y2) / 2;

  // Get vectors from original center to endpoints
  const dx1 = x1 - origCenterX;
  const dy1 = y1 - origCenterY;
  const dx2 = x2 - origCenterX;
  const dy2 = y2 - origCenterY;

  // Get the line's current center position
  const centerX = line.left || 0;
  const centerY = line.top || 0;

  // Get transformation properties
  const angle = (line.angle || 0) * Math.PI / 180;
  const scaleX = line.scaleX || 1;
  const scaleY = line.scaleY || 1;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // Transform endpoint 2 (where arrow head should be)
  const scaledDx2 = dx2 * scaleX;
  const scaledDy2 = dy2 * scaleY;
  const rotatedDx2 = scaledDx2 * cos - scaledDy2 * sin;
  const rotatedDy2 = scaledDx2 * sin + scaledDy2 * cos;

  // Transform endpoint 1 (for angle calculation)
  const scaledDx1 = dx1 * scaleX;
  const scaledDy1 = dy1 * scaleY;
  const rotatedDx1 = scaledDx1 * cos - scaledDy1 * sin;
  const rotatedDy1 = scaledDx1 * sin + scaledDy1 * cos;

  // Final positions in canvas coordinates
  const endX = centerX + rotatedDx2;
  const endY = centerY + rotatedDy2;
  const startX = centerX + rotatedDx1;
  const startY = centerY + rotatedDy1;

  // Calculate arrow angle
  const arrowAngle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);

  // Update triangle position and angle (keep size constant)
  triangle.set({
    left: endX,
    top: endY,
    angle: arrowAngle + 90, // +90 because triangle points up by default
  });
  triangle.setCoords();
}

/**
 * Setup arrow tool
 */
function setupArrowTool() {
  if (!fabricCanvas) return;

  cleanupShapeEvents();

  mouseDownHandler = (e: fabric.IEvent) => {
    isDrawing = true;
    const pointer = e.pointer;
    startX = pointer.x;
    startY = pointer.y;

    // Disable canvas selection during drawing
    fabricCanvas!.selection = false;

    // Create Line (the shaft of the arrow)
    currentArrowLine = new fabric.Line([startX, startY, startX, startY], {
      stroke: toolbarStore.color,
      strokeWidth: toolbarStore.strokeWidth,
      selectable: false,
      evented: false,
      hasBorders: false,
      hasControls: false,
      perPixelTargetFind: true,
      strokeUniform: true,
      originX: 'center',
      originY: 'center',
    });

    // Calculate arrow head size based on stroke width
    const headSize = Math.max(15, toolbarStore.strokeWidth * 3);

    // Create Triangle (the arrow head)
    currentArrowHead = new fabric.Triangle({
      left: startX,
      top: startY,
      width: headSize,
      height: headSize,
      fill: toolbarStore.color,
      selectable: false,
      evented: false,
      hasBorders: false,
      hasControls: false,
      originX: 'center',
      originY: 'center',
      angle: 0,
    });

    fabricCanvas!.add(currentArrowLine);
    fabricCanvas!.add(currentArrowHead);
  };

  mouseMoveHandler = (e: fabric.IEvent) => {
    if (!isDrawing || !currentArrowLine || !currentArrowHead) return;

    const pointer = e.pointer;
    let targetX = pointer.x;
    let targetY = pointer.y;

    // Snap to 45 degrees if Shift is pressed
    if ((e.e as MouseEvent).shiftKey) {
      const dx = targetX - startX;
      const dy = targetY - startY;

      if (dx !== 0 || dy !== 0) {
        const angle = Math.atan2(dy, dx);
        const length = Math.sqrt(dx * dx + dy * dy);

        // Snap to 45 degrees (PI/4)
        const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);

        targetX = startX + length * Math.cos(snapAngle);
        targetY = startY + length * Math.sin(snapAngle);
      }
    }

    // Update line end point
    currentArrowLine.set({
      x2: targetX,
      y2: targetY,
    });
    currentArrowLine.setCoords();

    // Calculate arrow head position and angle
    const dx = targetX - startX;
    const dy = targetY - startY;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI); // Convert to degrees for Fabric.js

    // Position triangle at the end of the line
    currentArrowHead.set({
      left: targetX,
      top: targetY,
      angle: angle + 90, // Rotate 90 degrees because Triangle points upward by default
    });
    currentArrowHead.setCoords();

    fabricCanvas!.renderAll();
  };

  mouseUpHandler = () => {
    if (!isDrawing) return;

    isDrawing = false;

    // Re-enable canvas selection
    fabricCanvas!.selection = true;

    if (currentArrowLine && currentArrowHead) {
      // Capture references in local scope for closure
      const arrowLine = currentArrowLine;
      const arrowHead = currentArrowHead;

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
        hasBorders: true,
        hasControls: true,
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
      // Use closure variables to avoid null reference
      const updateHandler = () => {
        updateArrowHead(arrowLine, arrowHead);
        fabricCanvas!.renderAll();
      };

      arrowLine.on('moving', updateHandler);
      arrowLine.on('scaling', updateHandler);
      arrowLine.on('rotating', updateHandler);
      arrowLine.on('modified', updateHandler);

      // Select the line
      fabricCanvas!.setActiveObject(arrowLine);
    }

    currentArrowLine = null;
    currentArrowHead = null;

    fabricCanvas!.renderAll();

    // Switch back to select mode
    toolbarStore.setTool('select');
  };

  fabricCanvas.on('mouse:down', mouseDownHandler);
  fabricCanvas.on('mouse:move', mouseMoveHandler);
  fabricCanvas.on('mouse:up', mouseUpHandler);
}

/**
 * Setup rectangle drawing
 */
function setupRectangleTool() {
  if (!fabricCanvas) return;
  
  cleanupShapeEvents();
  
  mouseDownHandler = (e: fabric.IEvent) => {
    isDrawing = true;
    const pointer = e.pointer;
    startX = pointer.x;
    startY = pointer.y;
    
    // Disable canvas selection during drawing
    fabricCanvas!.selection = false;
    
    currentShape = new fabric.Rect({
      left: startX,
      top: startY,
      width: 0,
      height: 0,
      stroke: toolbarStore.color,
      strokeWidth: toolbarStore.strokeWidth,
      fill: 'rgba(0,0,0,0.01)', // Nearly transparent but detectable
      selectable: false,
      evented: false,
      hasBorders: false,
      hasControls: false,
    });
    
    fabricCanvas!.add(currentShape);
  };
  
  mouseMoveHandler = (e: fabric.IEvent) => {
    if (!isDrawing || !currentShape) return;
    
    const pointer = e.pointer;
    let width = pointer.x - startX;
    let height = pointer.y - startY;
    
    // Constrain to square if Shift is pressed
    if ((e.e as MouseEvent).shiftKey) {
      const size = Math.max(Math.abs(width), Math.abs(height));
      width = width < 0 ? -size : size;
      height = height < 0 ? -size : size;
    }
    
    // Handle negative dimensions (dragging left or up)
    (currentShape as fabric.Rect).set({
      left: width < 0 ? startX + width : startX,
      top: height < 0 ? startY + height : startY,
      width: Math.abs(width),
      height: Math.abs(height),
    });
    
    fabricCanvas!.renderAll();
  };  
  mouseUpHandler = () => {
    if (!isDrawing) return;
    
    isDrawing = false;
    
    // Re-enable canvas selection
    fabricCanvas!.selection = true;
    
    if (currentShape) {
      currentShape.set({
        selectable: true,
        evented: true,
        hasBorders: true,
        hasControls: true,
        hoverCursor: 'move',
        moveCursor: 'move',
      });
      currentShape.setCoords(); // Update object coordinates
      
      // Select the newly created shape
      fabricCanvas!.setActiveObject(currentShape);
    }
    currentShape = null;
    
    fabricCanvas!.renderAll(); // Re-render canvas
    
    // Switch back to select mode
    toolbarStore.setTool('select');
  };
  
  fabricCanvas.on('mouse:down', mouseDownHandler);
  fabricCanvas.on('mouse:move', mouseMoveHandler);
  fabricCanvas.on('mouse:up', mouseUpHandler);
}

/**
 * Setup ellipse tool (formerly circle)
 */
function setupCircleTool() {
  if (!fabricCanvas) return;
  
  cleanupShapeEvents();
  
  mouseDownHandler = (e: fabric.IEvent) => {
    isDrawing = true;
    const pointer = e.pointer;
    startX = pointer.x;
    startY = pointer.y;
    
    // Disable canvas selection during drawing
    fabricCanvas!.selection = false;
    
    currentShape = new fabric.Ellipse({
      left: startX,
      top: startY,
      rx: 0,
      ry: 0,
      stroke: toolbarStore.color,
      strokeWidth: toolbarStore.strokeWidth,
      fill: 'rgba(0,0,0,0.01)', // Nearly transparent but detectable
      selectable: false,
      evented: false,
      hasBorders: false,
      hasControls: false,
      originX: 'left',
      originY: 'top',
    });
    
    fabricCanvas!.add(currentShape);
  };
  
  mouseMoveHandler = (e: fabric.IEvent) => {
    if (!isDrawing || !currentShape) return;
    
    const pointer = e.pointer;
    let width = pointer.x - startX;
    let height = pointer.y - startY;
    
    // Shift key -> Circle (equal width/height)
    if ((e.e as MouseEvent).shiftKey) {
       const maxDim = Math.max(Math.abs(width), Math.abs(height));
       width = width < 0 ? -maxDim : maxDim;
       height = height < 0 ? -maxDim : maxDim;
    }
    
    const rx = Math.abs(width) / 2;
    const ry = Math.abs(height) / 2;

    (currentShape as fabric.Ellipse).set({
      left: width < 0 ? startX + width : startX,
      top: height < 0 ? startY + height : startY,
      rx: rx,
      ry: ry,
    });
    
    fabricCanvas!.renderAll();
  };
  
  mouseUpHandler = () => {
    if (!isDrawing) return;
    
    isDrawing = false;
    
    // Re-enable canvas selection
    fabricCanvas!.selection = true;
    
    if (currentShape) {
      currentShape.set({
        selectable: true,
        evented: true,
        hasBorders: true,
        hasControls: true,
        hoverCursor: 'move',
        moveCursor: 'move',
      });
      currentShape.setCoords(); // Update object coordinates
      
      // Select the newly created shape
      fabricCanvas!.setActiveObject(currentShape);
    }
    currentShape = null;
    
    fabricCanvas!.renderAll(); // Re-render canvas
    
    // Switch back to select mode
    toolbarStore.setTool('select');
  };
  
  fabricCanvas.on('mouse:down', mouseDownHandler);
  fabricCanvas.on('mouse:move', mouseMoveHandler);
  fabricCanvas.on('mouse:up', mouseUpHandler);
}

/**
 * Setup text tool
 */
function setupTextTool() {
  if (!fabricCanvas) return;
  
    cleanupShapeEvents();
  
    mouseDownHandler = (e: fabric.IEvent) => {    const pointer = e.pointer;
    
    const text = new fabric.IText('', {
      left: pointer.x,
      top: pointer.y,
      fill: toolbarStore.color,
      fontSize: toolbarStore.fontSize,
    });
    
    fabricCanvas!.add(text);
    fabricCanvas!.setActiveObject(text);
    text.enterEditing();
    text.setCoords(); // Update object coordinates
    fabricCanvas!.renderAll(); // Re-render canvas
    
    // Don't switch to select mode immediately - let user finish typing
    // User can manually switch when done
  };
  
  fabricCanvas.on('mouse:down', mouseDownHandler);
}

/**
 * Setup eraser tool - white brush (like Paint)
 */
function setupEraserTool() {
  if (!fabricCanvas) return;
  
  cleanupShapeEvents();
  
  // Enable drawing mode with white color
  fabricCanvas.isDrawingMode = true;
  fabricCanvas.selection = false;
  
  // Set white color for eraser (like Paint)
  if (fabricCanvas.freeDrawingBrush) {
    fabricCanvas.freeDrawingBrush.color = '#ffffff';
    fabricCanvas.freeDrawingBrush.width = toolbarStore.strokeWidth;
  }
  
  // Set eraser cursor
  const eraserCursor = getEraserCursor();
  fabricCanvas.freeDrawingCursor = eraserCursor;
}

/**
 * Setup region selection tool - Paint-style area selection
 */
function setupRegionSelectTool() {
  if (!fabricCanvas) return;
  
  cleanupShapeEvents();
  
  // Remove any existing selection rectangle
  if (selectionRect) {
    fabricCanvas.remove(selectionRect);
    selectionRect = null;
  }
  
  // Enable object selection initially
  fabricCanvas.selection = true;
  
  mouseDownHandler = (e: fabric.IEvent) => {
    // Check if clicking on an existing object
    const target = e.target;
    if (target && target !== fabricCanvas) {
      // Clicked on an object, allow normal selection
      return;
    }
    
    // Clicked on empty space, start region selection
    isDrawing = true;
    const pointer = e.pointer;
    startX = pointer.x;
    startY = pointer.y;
    
    // Remove previous selection if exists
    if (selectionRect) {
      fabricCanvas!.remove(selectionRect);
      selectionRect = null;
    }
    
    // Disable object selection during region drawing
    fabricCanvas!.selection = false;
    fabricCanvas!.discardActiveObject();
    
    // Create selection rectangle with dashed border
    selectionRect = new fabric.Rect({
      left: startX,
      top: startY,
      width: 0,
      height: 0,
      fill: 'rgba(0, 0, 0, 0)', // Transparent fill
      stroke: '#000000',
      strokeWidth: 1,
      strokeDashArray: [5, 5], // Dashed line
      selectable: false,
      evented: false,
    });
    
    fabricCanvas!.add(selectionRect);
  };
  
mouseMoveHandler = (e: fabric.IEvent) => {
    if (!isDrawing || !selectionRect) return;
    
    const pointer = e.pointer;
    const width = pointer.x - startX;
    const height = pointer.y - startY;
    
    // Handle negative dimensions (dragging left or up)
    selectionRect.set({
      left: width < 0 ? pointer.x : startX,
      top: height < 0 ? pointer.y : startY,
      width: Math.abs(width),
      height: Math.abs(height),
    });
    
    fabricCanvas!.renderAll();
  };
  
  mouseUpHandler = () => {
    if (!isDrawing) return;
    isDrawing = false;
    
    // Re-enable object selection after region drawing
    fabricCanvas!.selection = true;
    
    // Keep selection rectangle on canvas for deletion
  };
  
  fabricCanvas.on('mouse:down', mouseDownHandler);
  fabricCanvas.on('mouse:move', mouseMoveHandler);
  fabricCanvas.on('mouse:up', mouseUpHandler);
}

/**
 * Copy the currently selected region to clipboard
 */
function copySelectedRegion() {
  if (!selectionRect || !fabricCanvas) return;
  
  const rect = selectionRect;
  const left = rect.left!;
  const top = rect.top!;
  const width = rect.width!;
  const height = rect.height!;
  
  // Skip if selection is too small (less than 1x1 pixel)
  if (width < 1 || height < 1) {
    toastStore.warning('Selection is too small to copy');
    return;
  }
  
  try {
    // Temporarily hide the selection rectangle
    const wasVisible = selectionRect.visible;
    selectionRect.set({ visible: false });
    fabricCanvas.renderAll();
    
    // Use setTimeout to ensure render completes before capturing
    setTimeout(() => {
      // Create a temporary canvas to capture the selected region
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (!tempCtx) {
        // Restore selection rectangle visibility
        selectionRect!.set({ visible: wasVisible });
        fabricCanvas!.renderAll();
        toastStore.error('Failed to copy region');
        return;
      }
      
      // Get the main canvas element
      const mainCanvas = fabricCanvas!.getElement();
      
      // Draw the selected region onto the temporary canvas
      tempCtx.drawImage(
        mainCanvas,
        left, top, width, height,  // Source rectangle
        0, 0, width, height        // Destination rectangle
      );
      
      // Restore selection rectangle visibility
      selectionRect!.set({ visible: wasVisible });
      fabricCanvas!.renderAll();
      
      // Convert to blob and copy to clipboard
      tempCanvas.toBlob(async (blob) => {
        if (!blob) {
          toastStore.error('Failed to copy region');
          return;
        }
        
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          toastStore.success('Region copied to clipboard');
        } catch (err) {
          console.error('Failed to copy to clipboard:', err);
          toastStore.error('Failed to copy region');
        }
      }, 'image/png');
    }, 10);
  } catch (err) {
    console.error('Error copying region:', err);
    toastStore.error('Failed to copy region');
  }
}

/**
 * Delete the currently selected region
 */
function deleteSelectedRegion() {
  if (!selectionRect || !fabricCanvas) return;
  
  const rect = selectionRect;
  const left = rect.left!;
  const top = rect.top!;
  const width = rect.width!;
  const height = rect.height!;
  
  // Skip if selection is too small (less than 1x1 pixel)
  if (width < 1 || height < 1) {
    // Just remove the selection rectangle
    fabricCanvas.remove(selectionRect);
    selectionRect = null;
    fabricCanvas.renderAll();
    return;
  }
  
  // Create a white rectangle to cover the selected area
  const whiteRect = new fabric.Rect({
    left: left,
    top: top,
    width: width,
    height: height,
    fill: '#ffffff',
    selectable: false,
    evented: false,
  });
  
  // Remove selection rectangle first
  fabricCanvas.remove(selectionRect);
  selectionRect = null;
  
  // Add white rectangle
  fabricCanvas.add(whiteRect);
  fabricCanvas.renderAll();
  
  // Flatten to background and save snapshot after completion
  setTimeout(() => {
    flattenCanvasToBackground(() => {
      saveCanvasSnapshot();
      toastStore.success('Selected region deleted');
    });
  }, 10);
}

/**
 * Save canvas snapshot to history
 */
function saveCanvasSnapshot() {
  if (!fabricCanvas) return;
  
  const dataUrl = fabricCanvas.toDataURL({
    format: 'png',
    quality: 0.9,
  });
  
  historyStore.saveSnapshot(dataUrl);
}

/**
 * Restore canvas from snapshot
 */
function restoreSnapshot(dataUrl: string) {
  if (!fabricCanvas) return;
  
  fabric.Image.fromURL(dataUrl, (img) => {
    fabricCanvas!.clear();
    fabricCanvas!.setBackgroundImage(img, () => {
      fabricCanvas!.backgroundColor = '#ffffff';
      fabricCanvas!.renderAll();
    }, {
      scaleX: fabricCanvas!.width! / img.width!,
      scaleY: fabricCanvas!.height! / img.height!,
    });
  });
}

/**
 * Flatten all objects to canvas background
 */
function flattenCanvasToBackground(callback?: () => void) {
  if (!fabricCanvas) return;
  
  // Skip in test environment if fabric.Image is not available
  if (!fabric.Image || typeof fabric.Image.fromURL !== 'function') {
    return;
  }
  
  // Get current canvas as image (includes all objects)
  const dataUrl = fabricCanvas.toDataURL({
    format: 'png',
    quality: 1,
  });
  
  // Clear all objects (check if getObjects exists for test compatibility)
  if (typeof fabricCanvas.getObjects === 'function') {
    fabricCanvas.getObjects().forEach((obj) => {
      fabricCanvas!.remove(obj);
    });
  }
  
  // Set the canvas image as background
  fabric.Image.fromURL(dataUrl, (img) => {
    if (!fabricCanvas) return;
    
    fabricCanvas.setBackgroundImage(img, () => {
      fabricCanvas!.renderAll();
      // Call callback after rendering is complete
      if (callback) {
        callback();
      }
    }, {
      scaleX: fabricCanvas!.width! / img.width!,
      scaleY: fabricCanvas!.height! / img.height!,
    });
  });
}

/**
 * Apply tool state to canvas
 */
function applyToolState(tool: typeof toolbarStore.currentTool) {
  if (!fabricCanvas) return;

  // Clean up any existing shape drawing handlers
  cleanupShapeEvents();

  // Disable all drawing modes first
  fabricCanvas.isDrawingMode = false;
  fabricCanvas.selection = true;
  
  // Reset brush to normal state
  if (fabricCanvas.freeDrawingBrush) {
    fabricCanvas.freeDrawingBrush.color = toolbarStore.color;
  }

  switch (tool) {
    case 'pen':
      fabricCanvas.isDrawingMode = true;
      break;
    case 'eraser':
      setupEraserTool();
      break;
    case 'select':
      setupRegionSelectTool();
      break;
    case 'line':
      setupLineTool();
      break;
    case 'arrow':
      setupArrowTool();
      break;
    case 'rectangle':
      setupRectangleTool();
      break;
    case 'ellipse':
      setupCircleTool();
      break;
    case 'text':
      setupTextTool();
      break;
  }
}

// Watch for tool changes
watch(() => toolbarStore.currentTool, (newTool) => {
  applyToolState(newTool);
  updateCanvasCursor();
});

// Watch for stroke width changes (for eraser cursor)
watch(() => toolbarStore.strokeWidth, (newWidth) => {
  if (!fabricCanvas || !fabricCanvas.freeDrawingBrush) return;
  fabricCanvas.freeDrawingBrush.width = newWidth;
  
  // Update eraser cursor size
  if (toolbarStore.currentTool === 'eraser') {
    updateCanvasCursor();
  }
});

// Watch for color changes
watch(() => toolbarStore.color, (newColor) => {
  if (!fabricCanvas || !fabricCanvas.freeDrawingBrush) return;
  // Don't change color when eraser is active
  if (toolbarStore.currentTool !== 'eraser') {
    fabricCanvas.freeDrawingBrush.color = newColor;
  }
});

/**
 * Add image to canvas from blob
 * Common logic for paste and drag-drop
 * @param blob - Image blob to add
 * @param position - Optional position {x, y}. If not provided, image is centered
 * @param source - Source of the image ('paste' or 'drop') for toast message
 */
function addImageToCanvas(blob: Blob, position?: { x: number; y: number }, source: 'paste' | 'drop' = 'paste') {
  if (!fabricCanvas) return;

  // Remove selection rectangle if exists
  if (selectionRect) {
    fabricCanvas.remove(selectionRect);
    selectionRect = null;
    fabricCanvas.renderAll();
  }

  // Read image as data URL
  const reader = new FileReader();
  reader.onload = (event) => {
    const dataUrl = event.target?.result as string;
    
    // Create Fabric.Image from data URL
    fabric.Image.fromURL(dataUrl, (img) => {
      if (!fabricCanvas) return;
      
      // Scale image to fit canvas (max 80% of canvas size)
      const maxWidth = fabricCanvas.width! * 0.8;
      const maxHeight = fabricCanvas.height! * 0.8;
      
      if (img.width! > maxWidth || img.height! > maxHeight) {
        const scale = Math.min(
          maxWidth / img.width!,
          maxHeight / img.height!
        );
        img.scale(scale);
      }
      
      // Position image
      if (position) {
        // Position at drop location
        img.set({
          left: position.x,
          top: position.y,
          originX: 'center',
          originY: 'center',
          hoverCursor: 'move',
          moveCursor: 'move',
        });
      } else {
        // Position at center
        img.set({
          left: fabricCanvas.width! / 2,
          top: fabricCanvas.height! / 2,
          originX: 'center',
          originY: 'center',
          hoverCursor: 'move',
          moveCursor: 'move',
        });
      }
      
      // Disable drawing mode to allow image manipulation
      fabricCanvas.isDrawingMode = false;
      
      // Add to canvas and select
      fabricCanvas.add(img);
      fabricCanvas.setActiveObject(img);
      fabricCanvas.renderAll();
      
      // Show success message
      const message = source === 'paste' ? 'Image pasted from clipboard' : 'Image added from file';
      toastStore.success(message);
    });
  };
  
  reader.readAsDataURL(blob);
}

/**
 * Handle clipboard paste event
 * Adds images from clipboard to canvas
 */
const handlePaste = async (e: ClipboardEvent) => {
  const items = e.clipboardData?.items;
  if (!items || !fabricCanvas) return;

  for (let i = 0; i < items.length; i++) {
    // Check if item is an image
    if (items[i].type.indexOf('image') !== -1) {
      const blob = items[i].getAsFile();
      if (!blob) continue;

      addImageToCanvas(blob, undefined, 'paste');
      break; // Only process first image
    }
  }
};

/**
 * Handle drag over event
 * Allows files to be dropped on canvas
 */
const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  
  // Set dropEffect to indicate copy operation
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy';
  }
};

/**
 * Handle drop event
 * Adds dropped image files to canvas
 */
const handleDrop = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  
  const files = e.dataTransfer?.files;
  if (!files || !fabricCanvas) return;

  // Process first image file only
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    // Check if file is an image
    if (file.type.indexOf('image') !== -1) {
      // Calculate drop position relative to canvas
      const canvasRect = canvasEl.value?.getBoundingClientRect();
      if (!canvasRect) {
        addImageToCanvas(file, undefined, 'drop');
        break;
      }
      
      const position = {
        x: e.clientX - canvasRect.left,
        y: e.clientY - canvasRect.top,
      };
      
      addImageToCanvas(file, position, 'drop');
      break; // Only process first image
    }
  }
};

onMounted(() => {
  if (!canvasEl.value) return;

  // Initialize Fabric.js canvas
  fabricCanvas = new fabric.Canvas(canvasEl.value, {
    width: window.innerWidth,
    height: window.innerHeight - 56, // Subtract toolbar height
    backgroundColor: '#ffffff',
    isDrawingMode: false, // Will be set by applyToolState
    targetFindTolerance: 10, // Increase click detection area (pixels)
    perPixelTargetFind: true, // Enable precise pixel detection
    uniformScaling: false, // Default to free resizing, Shift to preserve aspect ratio
    // Custom cursors for object manipulation
    hoverCursor: 'move', // Cursor when hovering over an object
    moveCursor: 'move', // Cursor when moving an object
    rotationCursor: 'url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMSAxMmEzIDMgMCAwIDAtMy0zSDdhM2EzYTAgMCAxIDAtMy0zIDkgOSAwIDEgMCAwIDE4IDkgOSAwIDAgMC05LTkiLz48cGF0aCBkPSJNMTEgNyAxNCA0bC0zLTMiLz48L3N2Zz4=) 12 12, auto', // Rotation cursor (refresh icon)
  });

  // Store fabricCanvas reference on canvas element for main process access
  canvasEl.value.fabric = fabricCanvas;
  
  // Override default cursor handler to set rotation cursor (only in non-test environment)
  // Using Lucide RotateCw icon as SVG cursor
  if (fabric.Object?.prototype) {
    const fabricObjectPrototype = fabric.Object.prototype as unknown as FabricObjectPrototype;
    if (fabricObjectPrototype.controls?.mtr) {
      const rotateCwSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>`;
      const rotateBase64 = btoa(rotateCwSvg);
      const rotateCursor = `url('data:image/svg+xml;base64,${rotateBase64}') 10 10, auto`;

      fabricObjectPrototype.controls.mtr.cursorStyleHandler = () => {
        return rotateCursor;
      };
    }
  }

  // Set willReadFrequently on Fabric.js internal canvases to suppress warnings
  // This is needed because Fabric.js reads pixel data frequently for hit detection
  try {
    const lowerCanvas = fabricCanvas.lowerCanvasEl;
    const upperCanvas = fabricCanvas.upperCanvasEl;
    if (lowerCanvas) {
      lowerCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (upperCanvas) {
      upperCanvas.getContext('2d', { willReadFrequently: true });
    }
  } catch (e) {
    // Ignore if context already created
  }

  // Configure drawing brush from store
  if (fabricCanvas.freeDrawingBrush) {
    fabricCanvas.freeDrawingBrush.color = toolbarStore.color;
    fabricCanvas.freeDrawingBrush.width = toolbarStore.strokeWidth;
  }

  // Apply initial tool state
  applyToolState(toolbarStore.currentTool);
  
  // Set initial cursor
  updateCanvasCursor();
  
  // Register selection:cleared event for flatten on deselect
fabricCanvas.on('selection:cleared', (e: fabric.IEvent<Event> & { deselected?: fabric.Object[] }) => {
    const deselected = e.deselected;
    if (deselected && deselected.length > 0) {
      // Flatten entire canvas to background
      flattenCanvasToBackground();
      
      // Save snapshot after flattening
      setTimeout(() => {
        saveCanvasSnapshot();
      }, 100); // Wait for background image to load
    }
  });

  // Register path:created event for pen and eraser tool - flatten immediately
  fabricCanvas.on('path:created', () => {
    // Flatten strokes immediately (no selection) and save snapshot after completion
    setTimeout(() => {
      flattenCanvasToBackground(() => {
        saveCanvasSnapshot();
      });
    }, 50);
  });
  
  // Load saved state (if exists)
  loadCanvasState().then(() => {
    // Save initial snapshot
    saveCanvasSnapshot();

    // Setup event-driven auto-save
    setupAutoSave();
  });

  // Handle keyboard shortcuts
  const handleKeydown = (e: KeyboardEvent) => {
    if (!fabricCanvas) return;
    
    // ESC - Cancel selection / Deselect
    if (e.key === 'Escape') {
      // Remove selection rectangle if exists
      if (selectionRect) {
        fabricCanvas.remove(selectionRect);
        selectionRect = null;
        fabricCanvas.renderAll();
        return;
      }
      
      // Deselect active object if exists
      const activeObject = fabricCanvas.getActiveObject();
      if (activeObject) {
        fabricCanvas.discardActiveObject();
        fabricCanvas.renderAll();
        return;
      }
    }
    
    // Ctrl+C - Copy selected region
    if (e.ctrlKey && e.key === 'c') {
      // Check if region is selected (select tool with selection rectangle)
      if (toolbarStore.currentTool === 'select' && selectionRect) {
        e.preventDefault();
        copySelectedRegion();
        return;
      }
    }
    
    // Delete key
    if (e.key === 'Delete') {
      // Check if region is selected (select tool with selection rectangle)
      if (toolbarStore.currentTool === 'select' && selectionRect) {
        deleteSelectedRegion();
        return;
      }
      
      // Otherwise, remove selected object
      const activeObject = fabricCanvas.getActiveObject();
      if (activeObject) {
        fabricCanvas.remove(activeObject);
        fabricCanvas.discardActiveObject();
        fabricCanvas.renderAll();
        saveCanvasSnapshot();
      }
    }
    
    // Ctrl+S - Save canvas as file
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      // Emit event to parent (App.vue) to handle save
      const event = new CustomEvent('save-canvas-shortcut');
      window.dispatchEvent(event);
    }

    // Ctrl+Z - Undo
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      const snapshot = historyStore.undo();
      if (snapshot) {
        restoreSnapshot(snapshot);
      }
    }

    // Ctrl+Shift+Z or Ctrl+Y - Redo
    if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') ||
        (e.ctrlKey && e.key === 'y')) {
      e.preventDefault();
      const snapshot = historyStore.redo();
      if (snapshot) {
        restoreSnapshot(snapshot);
      }
    }
  };
  
  document.addEventListener('keydown', handleKeydown);
  fabricCanvas._keydownHandler = handleKeydown;

  // Handle window resize
  const handleResize = () => {
    if (!fabricCanvas) return;
    fabricCanvas.setDimensions({
      width: window.innerWidth,
      height: window.innerHeight - 56, // Subtract toolbar height
    });
    fabricCanvas.renderAll();
  };

  window.addEventListener('resize', handleResize);

  // Register paste event listener
  window.addEventListener('paste', handlePaste);

  // Register drag and drop event listeners
  if (canvasEl.value) {
    canvasEl.value.addEventListener('dragover', handleDragOver);
    canvasEl.value.addEventListener('drop', handleDrop);
  }

  // Store handlers for cleanup
  fabricCanvas._resizeHandler = handleResize;
  fabricCanvas._pasteHandler = handlePaste;
  fabricCanvas._dragoverHandler = handleDragOver;
  fabricCanvas._dropHandler = handleDrop;
});

/**
 * Clear all objects from canvas
 * Exposed to parent component
 */
function clearCanvas() {
  if (fabricCanvas) {
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = '#ffffff';
    fabricCanvas.renderAll();
    
    // Save snapshot after clearing
    saveCanvasSnapshot();
  }
}

/**
 * Get canvas as Base64 image
 * Exposed to parent component and IPC
 * @param format - Image format ('png' or 'jpeg')
 * @returns Base64 encoded image (without data URL prefix) or null if canvas not initialized
 */
function getCanvasImage(format: 'png' | 'jpeg' = 'png'): string | null {
  if (!fabricCanvas) {
    return null;
  }
  
  try {
    // Export canvas as data URL
    const dataUrl = fabricCanvas.toDataURL({
      format: format,
      quality: format === 'jpeg' ? 0.95 : 1,
    });
    
    // Remove data URL prefix (e.g., "data:image/png;base64," or "data:image/jpeg;base64,")
    const base64 = dataUrl.replace(/^data:image\/(png|jpeg);base64,/, '');
    return base64;
  } catch (error) {
    console.error('Error converting canvas to image:', error);
    return null;
  }
}

/**
 * Setup event-driven auto-save
 */
function setupAutoSave() {
  if (!fabricCanvas || !autoSaveStore.isEnabled) return;

  // Setup history watcher for auto-save
  cleanupAutoSave = autoSaveStore.setupHistoryWatcher(
    historyStore,
    () => fabricCanvas!.toJSON()
  );
}

/**
 * Load canvas state from auto-save
 */
async function loadCanvasState() {
  if (!fabricCanvas) return;

  try {
    const state = await autoSaveStore.loadWhiteboardState();
    if (state && state.canvasData) {
      fabricCanvas.loadFromJSON(state.canvasData, () => {
        fabricCanvas!.renderAll();
        // Save initial snapshot after loading
        saveCanvasSnapshot();
      });
    }
  } catch (error) {
    console.error('Failed to load canvas state:', error);
  }
}

// Watch auto-save settings changes
watch(() => autoSaveStore.isEnabled, (enabled) => {
  if (enabled) {
    setupAutoSave();
  } else {
    if (cleanupAutoSave) {
      cleanupAutoSave();
      cleanupAutoSave = null;
    }
  }
});

// Expose methods to parent
defineExpose({
  clearCanvas,
  getCanvasImage,
});

onBeforeUnmount(() => {
  // Cleanup auto-save watcher
  if (cleanupAutoSave) {
    cleanupAutoSave();
    cleanupAutoSave = null;
  }

  // Perform final immediate auto-save
  if (autoSaveStore.isEnabled && fabricCanvas) {
    const canvasData = fabricCanvas.toJSON();
    autoSaveStore.performAutoSaveImmediately(canvasData);
  }

  if (fabricCanvas) {
    const resizeHandler = fabricCanvas._resizeHandler;
    const pasteHandler = fabricCanvas._pasteHandler;
    const keydownHandler = fabricCanvas._keydownHandler;
    const dragoverHandler = fabricCanvas._dragoverHandler;
    const dropHandler = fabricCanvas._dropHandler;

    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
    }
    if (pasteHandler) {
      window.removeEventListener('paste', pasteHandler);
    }
    if (keydownHandler) {
      document.removeEventListener('keydown', keydownHandler);
    }
    if (dragoverHandler && canvasEl.value) {
      canvasEl.value.removeEventListener('dragover', dragoverHandler);
    }
    if (dropHandler && canvasEl.value) {
      canvasEl.value.removeEventListener('drop', dropHandler);
    }

    // Clean up shape drawing handlers
    cleanupShapeEvents();

    fabricCanvas.dispose();
    fabricCanvas = null;
  }
});
</script>

<style scoped>
.whiteboard-container {
  width: 100vw;
  height: calc(100vh - 88px); /* Subtract titlebar (32px) + toolbar (56px) */
  margin-top: 88px; /* Titlebar + Toolbar height */
  overflow: hidden;
  position: relative;
}

#whiteboard-canvas {
  display: block;
}
</style>
