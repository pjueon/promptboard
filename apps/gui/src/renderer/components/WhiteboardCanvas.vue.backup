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
// Import from core-whiteboard package
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
  KeyboardHandler, 
  ClipboardHandler,
  DragDropHandler, 
  registerEditableLine,
  registerArrowObject,
  type ToolConfig
} from '@promptboard/core-whiteboard';

interface FabricCanvasElement extends HTMLCanvasElement {
  fabric?: fabric.Canvas;
}

// Extended Fabric.js types for custom properties
interface ExtendedFabricCanvas extends Omit<fabric.Canvas, '_activeObject' | 'backgroundColor' | 'backgroundImage'> {
  _resizeHandler?: () => void;
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

// Core whiteboard managers
let canvasManager: CanvasManager | null = null;
let toolManager: ToolManager | null = null;
let historyManager: HistoryManager | null = null;
let selectTool: SelectTool | null = null; // Keep reference for copySelectedRegion

// Handlers
let keyboardHandler: KeyboardHandler | null = null;
let clipboardHandler: ClipboardHandler | null = null;
let dragDropHandler: DragDropHandler | null = null;

// Reactive state for undo/redo buttons
const canUndoRef = ref(false);
const canRedoRef = ref(false);
// Loading state to prevent race conditions during testing
const isCanvasLoading = ref(true);

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

    // Re-render to ensure everything is drawn correctly
    fabricCanvas!.renderAll();
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


onMounted(() => {
  if (!canvasEl.value) return;

  // Initialize core whiteboard managers
  registerEditableLine(); // Register EditableLine for deserialization
  registerArrowObject(); // Register ArrowObject for deserialization
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

  // Expose historyManager and state for E2E testing (Moved after initialization)
  window.historyManager = historyManager;
  window.undoRedoState = {
    canUndo: canUndoRef,
    canRedo: canRedoRef
  };
  // Expose loading state for E2E testing
  window.isCanvasLoading = isCanvasLoading;

  // Setup event listeners for UI state updates
  historyManager.on('change', (event) => {
    canUndoRef.value = event.canUndo;
    canRedoRef.value = event.canRedo;
  });

  // Helper function to restore selection state after undo/redo
  const restoreSelectionAfterHistoryNav = () => {
    if (!fabricCanvas) return;
    
    // Find all objects that are selectable (in this app, only active objects are selectable)
    const selectableObjects = fabricCanvas.getObjects().filter(obj => obj.selectable);
    
    if (selectableObjects.length > 0) {
      if (selectableObjects.length === 1) {
        fabricCanvas.setActiveObject(selectableObjects[0]);
      } else {
        const selection = new fabric.ActiveSelection(selectableObjects, {
          canvas: fabricCanvas
        });
        fabricCanvas.setActiveObject(selection);
      }
      fabricCanvas.renderAll();
    }
  };

  // Reconnect arrows after undo/redo
  // Events are emitted after loadFromJSON callback completes
  historyManager.on('undo', () => {
    restoreSelectionAfterHistoryNav();
  });
  historyManager.on('redo', () => {
    restoreSelectionAfterHistoryNav();
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
  fabricCanvas.on('path:created', (e: fabric.IEvent<Event> & { path?: fabric.Path }) => {
    // Apply strokeUniform to the created path to prevent stroke width scaling
    if (e.path) {
      e.path.set({ strokeUniform: true });
    }

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
    
    // Mark loading as complete
    isCanvasLoading.value = false;
  });

  // Initialize Handlers
  const keyboardHandler = new KeyboardHandler(canvasManager, historyManager, toolManager, {
    onSave: () => {
      // Emit event to parent (App.vue) to handle save
      const event = new CustomEvent('save-canvas-shortcut');
      window.dispatchEvent(event);
    },
    onBrushSizeChange: (delta) => {
      const currentWidth = toolbarStore.strokeWidth;
      const newWidth = Math.max(1, Math.min(20, currentWidth + delta));
      toolbarStore.setStrokeWidth(newWidth);
      if (toolbarStore.currentTool === 'eraser') {
        updateCanvasCursor();
      }
    },
    onCopy: () => {
      // Only copy region if select tool is active and a region is selected
      if (toolbarStore.currentTool === 'select' && selectTool?.getSelectionRect()) {
        copySelectedRegion();
      }
    },
    onDelete: () => {
      // Prioritize deleting selection region
      if (toolbarStore.currentTool === 'select' && selectTool?.getSelectionRect()) {
        deleteSelectedRegion(); // This deletes the selection overlay and flattens
      } else {
        // Fallback: Delete currently active object(s)
        if (fabricCanvas) {
          const activeObject = fabricCanvas.getActiveObject();
          if (activeObject) {
            if (activeObject.type === 'activeSelection') {
              (activeObject as fabric.ActiveSelection).getObjects().forEach(obj => {
                fabricCanvas?.remove(obj);
              });
            } else {
              fabricCanvas.remove(activeObject);
            }
            fabricCanvas.discardActiveObject();
            fabricCanvas.renderAll();
            saveCanvasSnapshot(); // Save snapshot after deletion
          }
        }
      }
    }
  });
  keyboardHandler.attach();
  // If Electron API is not available (e.g., web environment in dev) use document listener
  if (window.electronAPI?.on) { // Check if window.electronAPI is defined and has 'on' property
    // Electron's main process will forward keydown events
    window.electronAPI.on('keydown', keyboardHandler.handleKeydown);
  }
  // No else block needed here, as keyboardHandler.attach() already adds document.addEventListener if not in Electron.

  const clipboardHandler = new ClipboardHandler(canvasManager, historyManager, {
    onPasteImage: () => toastStore.success('Image pasted from clipboard'),
    onError: (error) => toastStore.error(`Failed to paste image: ${error.message}`)
  });
  clipboardHandler.attach();
  // Removed window.addEventListener('paste', handlePaste);

  const dragDropHandler = new DragDropHandler(canvasManager, historyManager, {
    onDropImage: () => toastStore.success('Image added from file'),
    onError: (error) => toastStore.error(`Failed to add image: ${error.message}`)
  });
  if (canvasEl.value) {
    dragDropHandler.attach(canvasEl.value);
  }
  // Removed canvasEl.value.addEventListener('dragover', handleDragOver);
  // Removed canvasEl.value.addEventListener('drop', handleDrop);

  // Handle window resize
  const handleResize = () => {
    if (!canvasManager) return;
    canvasManager.resize(
      window.innerWidth,
      window.innerHeight - 56 // Subtract toolbar height
    );
  };
  window.addEventListener('resize', handleResize);

  // Store handlers for cleanup
  fabricCanvas._resizeHandler = handleResize; // Still need this for cleanup
  // Replaced individual handlers with class instances
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

  // Detach handlers
  if (keyboardHandler) { // Assuming keyboardHandler is accessible in this scope.
    keyboardHandler.detach();
  }
  if (clipboardHandler) {
    clipboardHandler.detach();
  }
  if (dragDropHandler) {
    dragDropHandler.detach();
  }

  if (fabricCanvas) {
    const resizeHandler = fabricCanvas._resizeHandler;

    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
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
