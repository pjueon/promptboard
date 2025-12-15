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
import '../fabric-ext/EditableLine';
import { useToolbarStore } from '../stores/toolbarStore';
import { useToastStore } from '../stores/toastStore';
import { useAutoSaveStore } from '../stores/autoSaveStore';
import { debounce } from '../utils/debounce';
import type { CanvasState } from '../types/canvas';
// NEW: Import from core-whiteboard package
import {
  CanvasManager,
  ToolManager,
  HistoryManager,
  LineTool,
  ArrowTool,
  RectangleTool,
  EllipseTool,
  TextTool,
  PenTool,
  EraserTool,
  SelectTool,
  registerEditableLine,
  type ToolConfig
} from '@promptboard/core-whiteboard';

interface FabricCanvasElement extends HTMLCanvasElement {
  fabric?: fabric.Canvas;
}

// Extended Fabric.js types for custom properties
interface ExtendedFabricCanvas extends Omit<fabric.Canvas, '_activeObject' | 'backgroundColor' | 'backgroundImage'> {
  _resizeHandler?: () => void;
  _pasteHandler?: (e: ClipboardEvent) => void;
  _keydownHandler?: (e: KeyboardEvent) => void;
  _dragoverHandler?: (e: DragEvent) => void;
  _dropHandler?: (e: DragEvent) => void;
  _activeObject?: fabric.Object | null | undefined;
  _hoveredTarget?: fabric.Object | null;
  upperCanvasEl?: HTMLCanvasElement;
  lowerCanvasEl?: HTMLCanvasElement;
  backgroundImage?: fabric.Image | string | null;
  backgroundColor?: string | fabric.Pattern | null;
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

// NEW: Core whiteboard managers (for refactored tools)
let canvasManager: CanvasManager | null = null;
let toolManager: ToolManager | null = null;
let historyManager: HistoryManager | null = null;
let selectTool: SelectTool | null = null; // Keep reference for copySelectedRegion

// Reactive state for undo/redo buttons
const canUndoRef = ref(false);
const canRedoRef = ref(false);

// Shape drawing state
let isDrawing = false;

// Mouse event handlers for shape drawing
let mouseDownHandler: ((e: fabric.IEvent<Event>) => void) | null = null;
let mouseMoveHandler: ((e: fabric.IEvent<Event>) => void) | null = null;
let mouseUpHandler: ((e: fabric.IEvent<Event>) => void) | null = null;

// Get stores
const toolbarStore = useToolbarStore();
const toastStore = useToastStore();
const autoSaveStore = useAutoSaveStore();

// Auto-save cleanup function
let cleanupAutoSave: (() => void) | null = null;
let debouncedAutoSave: ReturnType<typeof debounce> | null = null;

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
      // Eraser cursor is managed by EraserTool
      return;
    case 'select':
      cursor = 'default';
      // Set move cursor when hovering over objects
      fabricCanvas.defaultCursor = cursor;
      fabricCanvas.hoverCursor = 'move';

      // Immediately update the actual DOM cursor style
      if (fabricCanvas.upperCanvasEl) {
        fabricCanvas.upperCanvasEl.style.cursor = cursor;
      }
      return;
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

  // Immediately update the actual DOM cursor style (without waiting for mouse move)
  if (fabricCanvas.upperCanvasEl) {
    fabricCanvas.upperCanvasEl.style.cursor = cursor;
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
}

/**
 * Update arrow head position and angle based on line coordinates
 * Used when restoring canvas state from JSON
 */
function updateArrowHead(line: fabric.Line, triangle: fabric.Triangle) {
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
 * Copy the currently selected region to clipboard
 */
function copySelectedRegion() {
  const selectionRect = selectTool?.getSelectionRect();
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
  const selectionRect = selectTool?.getSelectionRect();
  if (!selectionRect || !fabricCanvas) return;

  const rect = selectionRect;
  const left = rect.left!;
  const top = rect.top!;
  const width = rect.width!;
  const height = rect.height!;
  
  // Skip if selection is too small (less than 1x1 pixel)
  if (width < 1 || height < 1) {
    // Just remove the selection rectangle
    selectTool?.removeSelectionRect();
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
  selectTool?.removeSelectionRect();

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
  if (!historyManager) return;

  // Don't save during restoration (HistoryManager handles this check)
  if (historyManager.isRestoringSnapshot()) {
    return;
  }

  historyManager.saveSnapshot();
}

/**
 * Reconnect arrow objects after canvas restoration
 * This is needed because arrow lines and heads need to be linked together
 */
function reconnectArrows() {
  if (!fabricCanvas) return;

  // Reconnect arrow objects and restore event handlers
  const objects = fabricCanvas.getObjects();
    const arrowMap = new Map<string, { line?: fabric.Line; head?: fabric.Triangle }>();

    // First pass: collect arrow objects by arrowId
    objects.forEach((obj) => {
      const arrowId = (obj as fabric.Object & { arrowId?: string }).arrowId;
      if (arrowId) {
        if (!arrowMap.has(arrowId)) {
          arrowMap.set(arrowId, {});
        }
        const arrowPair = arrowMap.get(arrowId)!;

        if (obj.type === 'line' || obj.type === 'editableLine') {
          arrowPair.line = obj as fabric.Line;
        } else if (obj.type === 'triangle') {
          arrowPair.head = obj as fabric.Triangle;
        }
      }
    });

    // Second pass: reconnect arrow pairs and restore event handlers
    arrowMap.forEach(({ line, head }) => {
      if (line && head) {
        // Restore references
        (line as fabric.Line & { arrowHead?: fabric.Triangle }).arrowHead = head;
        (head as fabric.Triangle & { arrowLine?: fabric.Line }).arrowLine = line;

        // Restore event handlers for arrow line
        const updateHandler = () => {
          updateArrowHead(line, head);
          fabricCanvas!.renderAll();
        };

        line.on('moving', updateHandler);
        line.on('scaling', updateHandler);
        line.on('rotating', updateHandler);
        line.on('modified', updateHandler);
      }
    });

  // Auto-select restored objects if any (restore selection state)
  if (objects && objects.length > 0) {
    // Select the last object (most recently added/modified)
    let lastObject = objects[objects.length - 1];

    // If the last object is not selectable (e.g., arrow head triangle)
    // try to find its associated selectable object (e.g., arrow line)
    if (lastObject.selectable === false) {
      // Check if it's part of an arrow (has arrowLine reference)
      const arrowLine = (lastObject as fabric.Object & { arrowLine?: fabric.Object }).arrowLine;
      if (arrowLine && arrowLine.selectable) {
        lastObject = arrowLine;
      } else {
        // Find the last selectable object
        for (let i = objects.length - 1; i >= 0; i--) {
          if (objects[i].selectable !== false) {
            lastObject = objects[i];
            break;
          }
        }
      }
    }

    // Only select if the object is selectable
    if (lastObject.selectable !== false) {
      fabricCanvas.setActiveObject(lastObject);
    }
  } else {
    // Clear selection when no objects (prevents ghost bounding box)
    fabricCanvas.discardActiveObject();
  }

  fabricCanvas.renderAll();

  // Extra clear to ensure no ghost selection
  if (objects.length === 0) {
    setTimeout(() => {
      fabricCanvas!.discardActiveObject();
      fabricCanvas!._activeObject = null;
      fabricCanvas!._hoveredTarget = null;
      fabricCanvas!.requestRenderAll();
    }, 50);
  }
}

/**
 * Restore canvas from snapshot (legacy - kept for manual restoration)
 */
function restoreSnapshot(canvasState: CanvasState) {
  if (!fabricCanvas) return;

  // Clear selection before clearing canvas
  fabricCanvas.discardActiveObject();

  // Clear canvas completely first to prevent background accumulation
  fabricCanvas.clear();

  // Force clear internal selection state
  fabricCanvas._activeObject = null;
  fabricCanvas._hoveredTarget = null;

  fabricCanvas.backgroundColor = '#ffffff';
  fabricCanvas.backgroundImage = null;

  fabricCanvas.loadFromJSON(canvasState, () => {
    // Ensure white background if no background image
    if (!fabricCanvas!.backgroundImage) {
      fabricCanvas!.backgroundColor = '#ffffff';
    }

    // Reconnect arrows after restoration
    reconnectArrows();
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

  // Store objects before removal
  const objectsToRemove = fabricCanvas.getObjects().slice();

  // Get current canvas as image (includes background + all objects)
  const dataUrl = fabricCanvas.toDataURL({
    format: 'png',
    quality: 1,
  });

  // Clear all objects
  objectsToRemove.forEach((obj) => {
    fabricCanvas!.remove(obj);
  });

  // Set the flattened image as background, replacing any previous background
  fabric.Image.fromURL(dataUrl, (img) => {
    if (!fabricCanvas) return;

    // Remove any objects that might have been added during async operation
    const currentObjects = fabricCanvas.getObjects().slice();

    // If user started drawing a new shape, don't remove it!
    if (isDrawing || toolManager?.isDrawing()) {
      // Just set the background image without removing objects
      fabricCanvas.setBackgroundImage(img, () => {
        fabricCanvas!.backgroundColor = null;
        fabricCanvas!.renderAll();
      }, {
        scaleX: fabricCanvas!.width! / img.width!,
        scaleY: fabricCanvas!.height! / img.height!,
      });
      return;
    }

    currentObjects.forEach((obj) => {
      fabricCanvas!.remove(obj);
    });

    fabricCanvas.setBackgroundImage(img, () => {
      fabricCanvas!.backgroundColor = null; // Clear background color
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

  // Deactivate any active toolManager tool when switching to a non-toolManager tool
  const toolManagerTools = ['line', 'arrow', 'rectangle', 'ellipse', 'text', 'eraser', 'select']; // List of tools managed by toolManager
  if (toolManager && toolManager.getActiveToolType() && !toolManagerTools.includes(tool)) {
    // Get the active tool and manually deactivate it
    const activeToolType = toolManager.getActiveToolType();
    if (activeToolType) {
      const activeTool = toolManager['tools'].get(activeToolType);
      if (activeTool) {
        activeTool.deactivate();
      }
    }
  }

  switch (tool) {
    case 'pen':
      // Use refactored PenTool from core-whiteboard
      if (toolManager) {
        toolManager.activateTool('pen');
      }
      break;
    case 'eraser':
      // Use refactored EraserTool from core-whiteboard
      if (toolManager) {
        toolManager.activateTool('eraser');
      }
      break;
    case 'select':
      // Use refactored SelectTool from core-whiteboard
      if (toolManager) {
        toolManager.activateTool('select');
      }
      break;
    case 'line':
      // Use refactored LineTool from core-whiteboard
      if (toolManager) {
        toolManager.activateTool('line');
      }
      break;
    case 'arrow':
      // Use refactored ArrowTool from core-whiteboard
      if (toolManager) {
        toolManager.activateTool('arrow');
      }
      break;
    case 'rectangle':
      // Use refactored RectangleTool from core-whiteboard
      if (toolManager) {
        toolManager.activateTool('rectangle');
      }
      break;
    case 'ellipse':
      // Use refactored EllipseTool from core-whiteboard
      if (toolManager) {
        toolManager.activateTool('ellipse');
      }
      break;
    case 'text':
      // Use refactored TextTool from core-whiteboard
      if (toolManager) {
        toolManager.activateTool('text');
      }
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

  // Update toolManager config (including EraserTool which updates cursor automatically)
  if (toolManager) {
    toolManager.updateConfig({
      color: toolbarStore.color,
      strokeWidth: newWidth,
      fontSize: toolbarStore.fontSize
    });
  }
});

// Watch for color changes
watch(() => toolbarStore.color, (newColor) => {
  if (!fabricCanvas || !fabricCanvas.freeDrawingBrush) return;
  // Don't change color when eraser is active
  if (toolbarStore.currentTool !== 'eraser') {
    fabricCanvas.freeDrawingBrush.color = newColor;
  }

  // Update toolManager config
  if (toolManager) {
    toolManager.updateConfig({
      color: newColor,
      strokeWidth: toolbarStore.strokeWidth,
      fontSize: toolbarStore.fontSize
    });
  }
});

// Watch for font size changes
watch(() => toolbarStore.fontSize, (newFontSize) => {
  // Update toolManager config
  if (toolManager) {
    toolManager.updateConfig({
      color: toolbarStore.color,
      strokeWidth: toolbarStore.strokeWidth,
      fontSize: newFontSize
    });
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
  if (selectTool?.getSelectionRect()) {
    selectTool?.removeSelectionRect();
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
      
      // Save snapshot for undo/redo
      saveCanvasSnapshot();
      
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


/**
 * Handle deletion of objects, including complex objects like arrows
 * @param canvas The fabric canvas instance
 */
function handleCanvasDelete(canvas: fabric.Canvas) {
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
  saveCanvasSnapshot();
}

onMounted(() => {
  if (!canvasEl.value) return;

  // NEW: Initialize core whiteboard managers
  registerEditableLine(); // Register EditableLine for deserialization
  canvasManager = new CanvasManager(canvasEl.value, {
    width: window.innerWidth,
    height: window.innerHeight - 56,
    backgroundColor: '#ffffff'
  });

  // Get the single canvas instance from the manager
  fabricCanvas = canvasManager.getCanvas() as ExtendedFabricCanvas;

  // Store fabricCanvas reference on canvas element for main process access
  canvasEl.value.fabric = fabricCanvas as fabric.Canvas;
  
  // Expose fabricCanvas globally for E2E testing
  (window as { fabricCanvas?: ExtendedFabricCanvas }).fabricCanvas = fabricCanvas;
  
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

  const toolConfig: ToolConfig = {
    color: toolbarStore.color,
    strokeWidth: toolbarStore.strokeWidth,
    fontSize: toolbarStore.fontSize
  };

  toolManager = new ToolManager(fabricCanvas as fabric.Canvas, toolConfig);

  // Initialize HistoryManager
  historyManager = new HistoryManager(canvasManager, {
    maxHistory: 50,
    propertiesToInclude: ['arrowId', 'selectable', 'evented']
  });

  // Setup event listeners for UI state updates
  historyManager.on('change', (event) => {
    canUndoRef.value = event.canUndo;
    canRedoRef.value = event.canRedo;
  });

  // Reconnect arrows after undo/redo
  // Events are emitted after loadFromJSON callback completes
  historyManager.on('undo', () => {
    reconnectArrows();
  });
  historyManager.on('redo', () => {
    reconnectArrows();
  });

  // Register refactored tools
  const lineTool = new LineTool(
    fabricCanvas as fabric.Canvas,
    toolConfig,
    () => saveCanvasSnapshot(),
    () => toolbarStore.setTool('select') // Switch back to select mode after drawing
  );
  toolManager.registerTool('line', lineTool);

  const rectangleTool = new RectangleTool(
    fabricCanvas as fabric.Canvas,
    toolConfig,
    () => saveCanvasSnapshot(),
    () => toolbarStore.setTool('select')
  );
  toolManager.registerTool('rectangle', rectangleTool);

  const ellipseTool = new EllipseTool(
    fabricCanvas as fabric.Canvas,
    toolConfig,
    () => saveCanvasSnapshot(),
    () => toolbarStore.setTool('select')
  );
  toolManager.registerTool('ellipse', ellipseTool);

  const arrowTool = new ArrowTool(
    fabricCanvas as fabric.Canvas,
    toolConfig,
    () => saveCanvasSnapshot(),
    () => toolbarStore.setTool('select')
  );
  toolManager.registerTool('arrow', arrowTool);

  const textTool = new TextTool(
    fabricCanvas as fabric.Canvas,
    toolConfig,
    () => saveCanvasSnapshot()
    // Note: No onComplete callback - user manually switches when done typing
  );
  toolManager.registerTool('text', textTool);

  const penTool = new PenTool(
    fabricCanvas as fabric.Canvas,
    toolConfig
    // Note: No callbacks - pen uses path:created event for snapshot saving
  );
  toolManager.registerTool('pen', penTool);

  const eraserTool = new EraserTool(
    fabricCanvas as fabric.Canvas,
    toolConfig
    // Note: No callbacks - eraser uses path:created event for snapshot saving
  );
  toolManager.registerTool('eraser', eraserTool);

  selectTool = new SelectTool(
    fabricCanvas as fabric.Canvas,
    toolConfig
    // Note: No callbacks - select tool doesn't auto-complete or save snapshots
  );
  toolManager.registerTool('select', selectTool);

  // Apply initial tool state
  applyToolState(toolbarStore.currentTool);
  
  // Set initial cursor
  updateCanvasCursor();
  
  // Register selection:cleared event to save snapshot on deselect
fabricCanvas.on('selection:cleared', (e: fabric.IEvent<Event> & { deselected?: fabric.Object[] }) => {
    if (historyManager?.isRestoringSnapshot()) return; // Skip during undo/redo
    if (isDrawing || toolManager?.isDrawing()) return; // Skip while user is actively drawing a new shape

    const deselected = e.deselected;
    if (deselected && deselected.length > 0) {
      // Make deselected objects non-selectable to prevent interference
      // This ensures only the last modified object remains interactive
      deselected.forEach(obj => {
        obj.set({
          selectable: false,
          evented: false
        });
      });
      fabricCanvas!.renderAll();

      // Save snapshot on deselection
      saveCanvasSnapshot();
    }
  });

  // Register object:modified event for saving snapshots on resize/rotate/move
  fabricCanvas.on('object:modified', () => {
    if (!historyManager?.isRestoringSnapshot()) {
      // Delay snapshot to ensure canvas is fully rendered
      setTimeout(() => {
        saveCanvasSnapshot();
      }, 50);
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
  
  // Save initial empty canvas snapshot first
  // This ensures we can undo back to a blank canvas
  saveCanvasSnapshot();

  // Load saved state (if exists)
  loadCanvasState().then(() => {
    // Save snapshot after loading auto-save state (if any was loaded)
    // This creates a second snapshot with the loaded state
    saveCanvasSnapshot();

    // Setup event-driven auto-save
    setupAutoSave();
  });

  // Handle keyboard shortcuts
  const handleKeydown = (e: KeyboardEvent) => {
    if (!fabricCanvas) return;

    // Check if user is editing text (to prevent shortcuts from interfering)
    const activeObject = fabricCanvas.getActiveObject();
    const isEditingText = activeObject && activeObject.type === 'i-text' && (activeObject as fabric.IText).isEditing;

    // [ - Decrease stroke width (disabled during text editing)
    if (e.key === '[' && !isEditingText) {
      const currentWidth = toolbarStore.strokeWidth;
      const newWidth = Math.max(1, currentWidth - 1);
      toolbarStore.setStrokeWidth(newWidth);
      // Update eraser cursor immediately if eraser tool is active
      if (toolbarStore.currentTool === 'eraser') {
        updateCanvasCursor();
      }
      return;
    }

    // ] - Increase stroke width (disabled during text editing)
    if (e.key === ']' && !isEditingText) {
      const currentWidth = toolbarStore.strokeWidth;
      const newWidth = Math.min(20, currentWidth + 1);
      toolbarStore.setStrokeWidth(newWidth);
      // Update eraser cursor immediately if eraser tool is active
      if (toolbarStore.currentTool === 'eraser') {
        updateCanvasCursor();
      }
      return;
    }

    // ESC - Cancel selection / Deselect
    if (e.key === 'Escape') {
      // Remove selection rectangle if exists
      if (selectTool?.getSelectionRect()) {
        selectTool?.removeSelectionRect();
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
      if (toolbarStore.currentTool === 'select' && selectTool?.getSelectionRect()) {
        e.preventDefault();
        copySelectedRegion();
        return;
      }
    }
    
    // Delete key
    if (e.key === 'Delete') {
      // Check if region is selected (select tool with selection rectangle)
      if (toolbarStore.currentTool === 'select' && selectTool?.getSelectionRect()) {
        deleteSelectedRegion();
        return;
      }
      
      // Otherwise, remove selected object(s)
      handleCanvasDelete(fabricCanvas);
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
      if (historyManager) {
        historyManager.undo();
        // HistoryManager automatically restores the snapshot
      }
    }

    // Ctrl+Shift+Z or Ctrl+Y - Redo
    if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') ||
        (e.ctrlKey && e.key === 'y')) {
      e.preventDefault();
      if (historyManager) {
        historyManager.redo();
        // HistoryManager automatically restores the snapshot
      }
    }
  };
  
  document.addEventListener('keydown', handleKeydown);
  fabricCanvas._keydownHandler = handleKeydown;

  // Handle window resize
  const handleResize = () => {
    if (!canvasManager) return;
    canvasManager.resize(
      window.innerWidth,
      window.innerHeight - 56 // Subtract toolbar height
    );
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
  if (!fabricCanvas) return;

  // First flatten any objects to background (this handles selection state)
  // Then clear everything including the background
  flattenCanvasToBackground(() => {
    if (!fabricCanvas) return;

    // Now clear the entire canvas including background
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = '#ffffff';

    // Force clear internal selection state (fixes #22)
    fabricCanvas._activeObject = null;
    fabricCanvas._hoveredTarget = null;

    fabricCanvas.renderAll();

    // Save snapshot after clearing
    saveCanvasSnapshot();
  });
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
  if (!historyManager || !canvasManager || !autoSaveStore.isEnabled) return;

  // Create debounced save function
  debouncedAutoSave = debounce(async () => {
    if (autoSaveStore.isEnabled && canvasManager) {
      const canvasData = canvasManager.toJSON(['arrowId', 'selectable', 'evented']);
      await autoSaveStore.saveWhiteboardState(canvasData);
    }
  }, autoSaveStore.debounceMs);

  // Subscribe to history changes for auto-save
  const unsubscribe = historyManager.on('snapshot', () => {
    if (autoSaveStore.isEnabled && debouncedAutoSave) {
      debouncedAutoSave();
    }
  });

  // Setup cleanup function
  cleanupAutoSave = () => {
    if (debouncedAutoSave) {
      debouncedAutoSave.cancel();
      debouncedAutoSave = null;
    }
    unsubscribe();
  };
}

/**
 * Load canvas state from auto-save
 */
async function loadCanvasState() {
  if (!fabricCanvas) return;

  try {
    const state = await autoSaveStore.loadWhiteboardState();
    if (state && state.canvasData) {
      // Wait for loadFromJSON to complete before resolving
      return new Promise<void>((resolve) => {
        restoreSnapshot(state.canvasData);
        resolve();
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

// Expose methods and state to parent
defineExpose({
  clearCanvas,
  getCanvasImage,
  canUndoRef,
  canRedoRef,
});

onBeforeUnmount(() => {
  // Cleanup auto-save watcher
  if (cleanupAutoSave) {
    cleanupAutoSave();
    cleanupAutoSave = null;
  }

  // Perform final immediate auto-save
  if (autoSaveStore.isEnabled && canvasManager) {
    const canvasData = canvasManager.toJSON(['arrowId', 'selectable', 'evented']);
    autoSaveStore.performAutoSaveImmediately(canvasData);
  }

  // Dispose HistoryManager
  if (historyManager) {
    historyManager.dispose();
    historyManager = null;
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
