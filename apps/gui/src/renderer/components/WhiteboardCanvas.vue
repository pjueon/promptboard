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

// Canvas element reference
const canvasEl = ref<FabricCanvasElement | null>(null);

// Fabric.js canvas instance
let fabricCanvas: fabric.Canvas | null = null;

// Shape drawing state
let isDrawing = false;
let currentShape: fabric.Object | null = null;
let startX = 0;
let startY = 0;

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

// Auto-save timer
let autoSaveTimer: number | null = null;

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
    case 'rectangle':
    case 'circle':
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
    });
    
    fabricCanvas!.add(currentShape);
  };
  
mouseMoveHandler = (e: fabric.IEvent) => {
    if (!isDrawing || !currentShape) return;
    
    const pointer = e.pointer;
    (currentShape as fabric.Line).set({
      x2: pointer.x,
      y2: pointer.y,
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
    const width = pointer.x - startX;
    const height = pointer.y - startY;
    
    // Handle negative dimensions (dragging left or up)
    (currentShape as fabric.Rect).set({
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
 * Setup circle drawing
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
    
    currentShape = new fabric.Circle({
      left: startX,
      top: startY,
      radius: 0,
      stroke: toolbarStore.color,
      strokeWidth: toolbarStore.strokeWidth,
      fill: 'rgba(0,0,0,0.01)', // Nearly transparent but detectable
      selectable: false,
      evented: false,
      hasBorders: false,
      hasControls: false,
      originX: 'center',
      originY: 'center',
    });
    
    fabricCanvas!.add(currentShape);
  };
  
  mouseMoveHandler =  (e: fabric.IEvent) => {
    if (!isDrawing || !currentShape) return;
    
    const pointer = e.pointer;
    const radius = Math.sqrt(
      Math.pow(pointer.x - startX, 2) + Math.pow(pointer.y - startY, 2)
    );
    
    (currentShape as fabric.Circle).set({
      radius: radius,
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
    case 'rectangle':
      setupRectangleTool();
      break;
    case 'circle':
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
          
          // Position image at center
          img.set({
            left: fabricCanvas.width! / 2,
            top: fabricCanvas.height! / 2,
            originX: 'center',
            originY: 'center',
            hoverCursor: 'move',
            moveCursor: 'move',
          });
          
          // Disable drawing mode to allow image manipulation
          fabricCanvas.isDrawingMode = false;
          
          // Add to canvas and select
          fabricCanvas.add(img);
          fabricCanvas.setActiveObject(img);
          fabricCanvas.renderAll();
          
          toastStore.success('Image pasted from clipboard');
        });
      };
      
      reader.readAsDataURL(blob);
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
    // Custom cursors for object manipulation
    hoverCursor: 'move', // Cursor when hovering over an object
    moveCursor: 'move', // Cursor when moving an object
    rotationCursor: 'url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMSAxMmEzIDMgMCAwIDAtMy0zSDdhM2EzYTAgMCAxIDAtMy0zIDkgOSAwIDEgMCAwIDE4IDkgOSAwIDAgMC05LTkiLz48cGF0aCBkPSJNMTEgNyAxNCA0bC0zLTMiLz48L3N2Zz4=) 12 12, auto', // Rotation cursor (refresh icon)
  });

  // Store fabricCanvas reference on canvas element for main process access
  canvasEl.value.fabric = fabricCanvas;
  
  // Override default cursor handler to set rotation cursor (only in non-test environment)
  // Using Lucide RotateCw icon as SVG cursor
  if (fabric.Object && fabric.Object.prototype && (fabric.Object.prototype as any).controls) {
    const rotateCwSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>`;
    const rotateBase64 = btoa(rotateCwSvg);
    const rotateCursor = `url('data:image/svg+xml;base64,${rotateBase64}') 10 10, auto`;
    
    (fabric.Object.prototype as any).controls.mtr.cursorStyleHandler = () => {
      return rotateCursor;
    };
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

    // Start auto-save timer
    if (autoSaveStore.isEnabled) {
      startAutoSave();
    }
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
  (fabricCanvas as any)._keydownHandler = handleKeydown;

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

  // Store handlers for cleanup
  (fabricCanvas as any)._resizeHandler = handleResize;
  (fabricCanvas as any)._pasteHandler = handlePaste;
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
 * Get canvas as Base64 PNG image
 * Exposed to parent component and IPC
 * @returns Base64 encoded PNG (without data URL prefix) or null if canvas not initialized
 */
function getCanvasImage(): string | null {
  if (!fabricCanvas) {
    return null;
  }
  
  try {
    // Export canvas as PNG data URL
    const dataUrl = fabricCanvas.toDataURL({
      format: 'png',
      quality: 1,
    });
    
    // Remove "data:image/png;base64," prefix
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    return base64;
  } catch (error) {
    console.error('Error converting canvas to image:', error);
    return null;
  }
}

/**
 * Auto-save canvas state
 */
async function performAutoSave() {
  if (!fabricCanvas || !autoSaveStore.isEnabled) return;

  try {
    const canvasData = fabricCanvas.toJSON();
    await autoSaveStore.saveWhiteboardState(canvasData);
  } catch (error) {
    console.error('Auto-save failed:', error);
  }
}

/**
 * Start auto-save timer
 */
function startAutoSave() {
  stopAutoSave();

  if (!autoSaveStore.isEnabled) return;

  autoSaveTimer = window.setInterval(() => {
    performAutoSave();
  }, autoSaveStore.intervalSeconds * 1000);
}

/**
 * Stop auto-save timer
 */
function stopAutoSave() {
  if (autoSaveTimer !== null) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }
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
    startAutoSave();
  } else {
    stopAutoSave();
  }
});

watch(() => autoSaveStore.intervalSeconds, () => {
  if (autoSaveStore.isEnabled) {
    startAutoSave();
  }
});

// Expose methods to parent
defineExpose({
  clearCanvas,
  getCanvasImage,
});

onBeforeUnmount(() => {
  // Stop auto-save
  stopAutoSave();

  // Perform final auto-save
  if (autoSaveStore.isEnabled) {
    performAutoSave();
  }

  if (fabricCanvas) {
    const resizeHandler = (fabricCanvas as any)._resizeHandler;
    const pasteHandler = (fabricCanvas as any)._pasteHandler;
    const keydownHandler = (fabricCanvas as any)._keydownHandler;

    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
    }
    if (pasteHandler) {
      window.removeEventListener('paste', pasteHandler);
    }
    if (keydownHandler) {
      document.removeEventListener('keydown', keydownHandler);
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
