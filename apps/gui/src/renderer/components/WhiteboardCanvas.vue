<template>
  <div class="whiteboard-container">
    <canvas
      id="whiteboard-canvas"
      ref="canvasRef"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch } from 'vue';
import { fabric } from 'fabric';
import { useWhiteboard } from '@promptboard/vue-whiteboard';
import {
  KeyboardHandler,
  ClipboardHandler,
  DragDropHandler,
  SelectTool,
  LineTool,
  ArrowTool,
  RectangleTool,
  EllipseTool,
  TextTool,
  PenTool,
  EraserTool,
  ToolManager,
  type ToolType,
} from '@promptboard/core-whiteboard';
import { useToolbarStore } from '../stores/toolbarStore';
import { useToastStore } from '../stores/toastStore';
import { useAutoSaveStore } from '../stores/autoSaveStore';
import { debounce } from '../utils/debounce';

// Stores
const toolbarStore = useToolbarStore();
const toastStore = useToastStore();
const autoSaveStore = useAutoSaveStore();

// Whiteboard composable
const whiteboard = useWhiteboard();

// Expose canvasRef for the composable to use
const { canvasRef, isReady, canUndo, canRedo } = whiteboard;

// Handlers
let keyboardHandler: KeyboardHandler | null = null;
let clipboardHandler: ClipboardHandler | null = null;
let dragDropHandler: DragDropHandler | null = null;
let debouncedAutoSave: ReturnType<typeof debounce> | null = null;

// SelectTool reference for copySelectedRegion
let selectTool: SelectTool | null = null;

// Store reference to toolManager for direct config updates
let toolManagerRef: ToolManager | null = null;

/**
 * Update canvas cursor based on current tool
 */
function updateCanvasCursor() {
  const canvas = whiteboard.getCanvas();
  if (!canvas) return;

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
    case 'select': {
      cursor = 'default';
      // Set move cursor when hovering over objects
      canvas.defaultCursor = cursor;
      canvas.hoverCursor = 'move';

      // Immediately update the actual DOM cursor style
      const upperCanvasEl = (canvas as fabric.Canvas & { upperCanvasEl?: HTMLCanvasElement })
        .upperCanvasEl;
      if (upperCanvasEl) {
        upperCanvasEl.style.cursor = cursor;
      }
      return;
    }
    default:
      cursor = 'default';
      break;
  }

  canvas.defaultCursor = cursor;
  // Don't set hoverCursor for drawing tools to allow object controls to show their cursors
  // hoverCursor will be managed by Fabric.js for object interactions

  // For drawing mode (pen and eraser), also set freeDrawingCursor
  if (canvas.isDrawingMode) {
    canvas.freeDrawingCursor = cursor;
  }

  // Immediately update the actual DOM cursor style (without waiting for mouse move)
  const upperCanvasEl = (canvas as fabric.Canvas & { upperCanvasEl?: HTMLCanvasElement })
    .upperCanvasEl;
  if (upperCanvasEl) {
    upperCanvasEl.style.cursor = cursor;
  }

  canvas.renderAll();
}

/**
 * Copy the currently selected region to clipboard
 */
function copySelectedRegion() {
  const selectionRect = selectTool?.getSelectionRect();
  const canvas = whiteboard.getCanvas();
  if (!selectionRect || !canvas) return;

  const rect = selectionRect;
  const left = rect.left!;
  const top = rect.top!;
  const width = rect.width!;
  const height = rect.height!;

  // Skip if selection is too small
  if (width < 1 || height < 1) {
    toastStore.warning('Selection is too small to copy');
    return;
  }

  try {
    // Temporarily hide the selection rectangle
    const wasVisible = selectionRect.visible;
    selectionRect.set({ visible: false });
    canvas.renderAll();

    setTimeout(() => {
      // Create a temporary canvas to capture the selected region
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d');

      if (!tempCtx) {
        selectionRect!.set({ visible: wasVisible });
        canvas!.renderAll();
        toastStore.error('Failed to copy region');
        return;
      }

      // Get the main canvas element
      const mainCanvas = canvas!.getElement();

      // Draw the selected region onto the temporary canvas
      tempCtx.drawImage(
        mainCanvas,
        left,
        top,
        width,
        height, // Source rectangle
        0,
        0,
        width,
        height // Destination rectangle
      );

      // Restore selection rectangle visibility
      selectionRect!.set({ visible: wasVisible });
      canvas!.renderAll();

      // Convert to blob and copy to clipboard
      tempCanvas.toBlob(async (blob) => {
        if (!blob) {
          toastStore.error('Failed to copy region');
          return;
        }

        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
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
 * Flatten all objects to canvas background
 */
function flattenCanvasToBackground(callback?: () => void) {
  const canvas = whiteboard.getCanvas();
  if (!canvas) return;

  // Skip in test environment if fabric.Image is not available
  if (!fabric.Image || typeof fabric.Image.fromURL !== 'function') {
    return;
  }

  // Get current canvas as image (includes background + all objects)
  const dataUrl = canvas.toDataURL({
    format: 'png',
    quality: 1,
  });

  // Store objects before removal
  const objectsToRemove = canvas.getObjects().slice();

  // Clear all objects
  objectsToRemove.forEach((obj) => {
    canvas.remove(obj);
  });

  // Set the flattened image as background
  fabric.Image.fromURL(dataUrl, (img) => {
    if (!canvas) return;

    // Remove any objects that might have been added during async operation
    const currentObjects = canvas.getObjects().slice();

    // Check if toolManager is drawing (prevent removing objects being drawn)
    const managers = whiteboard.getManagers();
    if (managers.toolManager?.isDrawing()) {
      // Just set the background image without removing objects
      canvas.setBackgroundImage(
        img,
        () => {
          canvas.backgroundColor = null;
          canvas.renderAll();
        },
        {
          scaleX: canvas.width! / img.width!,
          scaleY: canvas.height! / img.height!,
        }
      );
      return;
    }

    currentObjects.forEach((obj) => {
      canvas.remove(obj);
    });

    canvas.setBackgroundImage(
      img,
      () => {
        canvas.backgroundColor = null;
        canvas.renderAll();

        // Call callback after rendering is complete
        if (callback) {
          callback();
        }
      },
      {
        scaleX: canvas.width! / img.width!,
        scaleY: canvas.height! / img.height!,
      }
    );
  });
}

/**
 * Delete the currently selected region
 */
function deleteSelectedRegion() {
  const selectionRect = selectTool?.getSelectionRect();
  const canvas = whiteboard.getCanvas();
  if (!selectionRect || !canvas) return;

  const rect = selectionRect;
  const left = rect.left!;
  const top = rect.top!;
  const width = rect.width!;
  const height = rect.height!;

  // Skip if selection is too small
  if (width < 1 || height < 1) {
    // Just remove the selection rectangle
    selectTool?.removeSelectionRect();
    canvas.renderAll();
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
  canvas.add(whiteRect);
  canvas.renderAll();

  // Flatten to background and save snapshot after completion
  setTimeout(() => {
    flattenCanvasToBackground(() => {
      const managers = whiteboard.getManagers();
      if (managers.historyManager) {
        managers.historyManager.saveSnapshot();
      }
      toastStore.success('Selected region deleted');
    });
  }, 10);
}

/**
 * Clear the canvas completely
 */
function clearCanvas() {
  const canvas = whiteboard.getCanvas();
  if (!canvas) return;

  // Get managers
  const managers = whiteboard.getManagers();

  // Clear everything and reset background (but keep undo/redo history)
  canvas.clear();
  canvas.backgroundColor = '#ffffff';
  canvas.renderAll();

  // Save snapshot after clearing so undo can restore previous state
  if (managers.historyManager) {
    managers.historyManager.saveSnapshot();
  }
}

/**
 * Get canvas image as base64
 */
function getCanvasImage(format: 'png' | 'jpeg' = 'png'): string | null {
  const canvas = whiteboard.getCanvas();
  if (!canvas) return null;

  try {
    const dataUrl = canvas.toDataURL({
      format: format,
      quality: format === 'jpeg' ? 0.95 : 1,
    });

    // Remove data URL prefix
    return dataUrl.replace(/^data:image\/(png|jpeg);base64,/, '');
  } catch (error) {
    console.error('Error converting canvas to image:', error);
    return null;
  }
}

/**
 * Setup auto-save functionality
 */
function setupAutoSave() {
  if (!autoSaveStore.isEnabled) return;

  // Create debounced save function
  debouncedAutoSave = debounce(async () => {
    if (autoSaveStore.isEnabled && isReady.value) {
      const state = await whiteboard.saveState();
      const canvasData = JSON.parse(state);
      await autoSaveStore.saveWhiteboardState(canvasData);
    }
  }, autoSaveStore.debounceMs);

  // Subscribe to history changes
  whiteboard.onHistoryChange(() => {
    if (autoSaveStore.isEnabled && debouncedAutoSave) {
      debouncedAutoSave();
    }
  });
}

/**
 * Load canvas state from auto-save
 */
async function loadCanvasState() {
  const state = await autoSaveStore.loadWhiteboardState();
  if (state && state.canvasData) {
    const stateString = JSON.stringify(state.canvasData);
    await whiteboard.loadState(stateString);
  }
}

/**
 * Initialize the whiteboard
 */
async function initializeWhiteboard() {
  try {
    // Override default rotation cursor handler to set custom rotation cursor
    // Using Lucide RotateCw icon as SVG cursor
    if (fabric.Object?.prototype) {
      const fabricObjectPrototype = fabric.Object.prototype as unknown as {
        controls?: {
          mtr?: {
            cursorStyleHandler?: () => string;
          };
        };
      };
      if (fabricObjectPrototype.controls?.mtr) {
        const rotateCwSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>`;
        const rotateBase64 = btoa(rotateCwSvg);
        const rotateCursor = `url('data:image/svg+xml;base64,${rotateBase64}') 10 10, auto`;

        fabricObjectPrototype.controls.mtr.cursorStyleHandler = () => {
          return rotateCursor;
        };
      }
    }

    // Initialize the whiteboard
    await whiteboard.initialize({
      width: window.innerWidth,
      height: window.innerHeight - 32,
      backgroundColor: '#ffffff',
    });

    const canvas = whiteboard.getCanvas();
    if (!canvas) return;

    // Get managers for handlers
    const managers = whiteboard.getManagers();
    if (!managers.canvasManager || !managers.historyManager || !managers.toolManager) {
      throw new Error('Managers not initialized');
    }

    // Re-register tools with callbacks for auto-switch and snapshot saving
    const toolConfig = whiteboard.getToolOptions();
    const saveSnapshot = () => {
      // Save snapshot after shape is drawn and selected
      if (managers.historyManager && !managers.historyManager.isRestoringSnapshot()) {
        managers.historyManager.saveSnapshot();
      }
    };
    const switchToSelect = () => {
      toolbarStore.setTool('select');
    };

    managers.toolManager.registerTool(
      'line',
      new LineTool(canvas, toolConfig, saveSnapshot, switchToSelect)
    );
    managers.toolManager.registerTool(
      'arrow',
      new ArrowTool(canvas, toolConfig, saveSnapshot, switchToSelect)
    );
    managers.toolManager.registerTool(
      'rectangle',
      new RectangleTool(canvas, toolConfig, saveSnapshot, switchToSelect)
    );
    managers.toolManager.registerTool(
      'ellipse',
      new EllipseTool(canvas, toolConfig, saveSnapshot, switchToSelect)
    );
    managers.toolManager.registerTool(
      'text',
      new TextTool(canvas, toolConfig, saveSnapshot)
    );
    managers.toolManager.registerTool('pen', new PenTool(canvas, toolConfig, saveSnapshot));
    managers.toolManager.registerTool(
      'eraser',
      new EraserTool(canvas, toolConfig, saveSnapshot)
    );

    // Get SelectTool instance for copySelectedRegion
    selectTool = new SelectTool(canvas, toolConfig);
    managers.toolManager.registerTool('select', selectTool);

    // Store toolManager reference for config updates
    toolManagerRef = managers.toolManager;

    // Setup handlers
    keyboardHandler = new KeyboardHandler(
      managers.canvasManager,
      managers.historyManager,
      managers.toolManager,
      {
        onSave: () => {
          // Trigger save dialog via custom event
          window.dispatchEvent(new Event('save-canvas-shortcut'));
        },
        onBrushSizeChange: (delta: number) => {
          const newWidth = toolbarStore.strokeWidth + delta;
          toolbarStore.setStrokeWidth(Math.max(1, Math.min(20, newWidth)));
        },
        onDelete: () => {
          // Check if SelectTool has a selection rectangle
          if (selectTool) {
            const selectionRect = selectTool.getSelectionRect();
            if (selectionRect) {
              deleteSelectedRegion();
              return;
            }
          }
          // Otherwise, delete selected objects
          const activeObject = canvas.getActiveObject();
          if (activeObject) {
            canvas.remove(activeObject);
            canvas.renderAll();
            if (managers.historyManager) {
              managers.historyManager.saveSnapshot();
            }
          }
        },
      }
    );
    keyboardHandler.attach();

    clipboardHandler = new ClipboardHandler(managers.canvasManager, managers.historyManager, {
      onPasteImage: () => {
        toastStore.success('Image pasted');
      },
    });
    clipboardHandler.attach();

    dragDropHandler = new DragDropHandler(managers.canvasManager, managers.historyManager, {
      onDropImage: () => {
        toastStore.success('Image added');
      },
    });
    dragDropHandler.attach(canvas.wrapperEl);

    // Helper function to restore selection state after undo/redo
    const restoreSelectionAfterHistoryNav = () => {
      if (!canvas) return;

      // Find all objects that are selectable (in this app, only active objects are selectable)
      const selectableObjects = canvas.getObjects().filter((obj) => obj.selectable);

      if (selectableObjects.length > 0) {
        if (selectableObjects.length === 1) {
          canvas.setActiveObject(selectableObjects[0]);
        } else {
          const selection = new fabric.ActiveSelection(selectableObjects, {
            canvas: canvas,
          });
          canvas.setActiveObject(selection);
        }
        canvas.renderAll();
      }
    };

    // Register undo/redo events to restore selection state
    managers.historyManager.on('undo', () => {
      restoreSelectionAfterHistoryNav();
    });
    managers.historyManager.on('redo', () => {
      restoreSelectionAfterHistoryNav();
    });

    // Register selection:cleared event to make deselected objects non-selectable
    canvas.on('selection:cleared', (e: fabric.IEvent) => {
      if (managers.historyManager?.isRestoringSnapshot()) return; // Skip during undo/redo
      if (managers.toolManager?.isDrawing()) return; // Skip while user is actively drawing

      const deselected = (e as fabric.IEvent & { deselected?: fabric.Object[] }).deselected;
      if (deselected && deselected.length > 0) {
        // Make deselected objects non-selectable to prevent interference
        // This ensures only newly drawn objects remain interactive until flattened
        deselected.forEach((obj) => {
          obj.set({
            selectable: false,
            evented: false,
          });
        });
        canvas.renderAll();

        // Save snapshot on deselection so undo can restore the selected state
        managers.historyManager?.saveSnapshot();
      }
    });

    // Register path:created event for pen and eraser tool - flatten immediately
    canvas.on('path:created', (e: fabric.IEvent & { path?: fabric.Path }) => {
      // Apply strokeUniform to the created path to prevent stroke width scaling
      if (e.path) {
        e.path.set({ strokeUniform: true });
      }

      // Flatten strokes immediately (no selection) and save snapshot after completion
      setTimeout(() => {
        flattenCanvasToBackground(() => {
          if (managers.historyManager) {
            managers.historyManager.saveSnapshot();
          }
        });
      }, 50);
    });

    // Save initial empty canvas snapshot first
    // This ensures we can undo back to a blank canvas
    managers.historyManager.saveSnapshot();

    // Load saved state (if exists)
    await loadCanvasState();

    // Save snapshot after loading auto-save state (if any was loaded)
    // This creates a second snapshot with the loaded state
    managers.historyManager.saveSnapshot();

    // Setup auto-save
    setupAutoSave();

    // Setup window resize handler
    const handleResize = () => {
      whiteboard.resize(window.innerWidth, window.innerHeight - 32);
    };
    window.addEventListener('resize', handleResize);

    // Store handleResize for cleanup
    interface WhiteboardWindow extends Window {
      __whiteboardResizeHandler?: () => void;
      getWhiteboardCanvas?: () => fabric.Canvas | null;
      clearCanvas?: () => void;
      getCanvasImage?: (format?: 'png' | 'jpeg') => string | null;
      copySelectedRegion?: () => void;
      deleteSelectedRegion?: () => void;
    }
    (window as WhiteboardWindow).__whiteboardResizeHandler = handleResize;

    // Expose canvas methods for E2E testing
    (window as WhiteboardWindow).getWhiteboardCanvas = () => canvas;
    (window as WhiteboardWindow).clearCanvas = clearCanvas;
    (window as WhiteboardWindow).getCanvasImage = getCanvasImage;
    (window as WhiteboardWindow).copySelectedRegion = copySelectedRegion;
    (window as WhiteboardWindow).deleteSelectedRegion = deleteSelectedRegion;

    // Also expose fabricCanvas and historyManager directly for backward compatibility with E2E tests
    (window as { fabricCanvas?: fabric.Canvas; historyManager?: typeof managers.historyManager }).fabricCanvas = canvas;
    (window as { fabricCanvas?: fabric.Canvas; historyManager?: typeof managers.historyManager }).historyManager = managers.historyManager;

    // Expose undo/redo state for E2E tests
    (window as { undoRedoState?: { canUndo: typeof canUndo; canRedo: typeof canRedo } }).undoRedoState = {
      canUndo,
      canRedo
    };
  } catch (error) {
    const msg = 'Failed to initialize whiteboard';
    console.error(`${msg}:`, error);
    toastStore.error(msg);
  }
}

// Watch toolbar changes
watch(
  () => toolbarStore.currentTool,
  (tool) => {
    if (isReady.value) {
      whiteboard.setTool(tool as ToolType);
      updateCanvasCursor();
    }
  }
);

watch(
  () => toolbarStore.color,
  (color) => {
    if (isReady.value && toolManagerRef) {
      toolManagerRef.updateConfig({ color });
    }
  }
);

watch(
  () => toolbarStore.strokeWidth,
  (strokeWidth) => {
    if (isReady.value && toolManagerRef) {
      toolManagerRef.updateConfig({ strokeWidth });
      // Update cursor for eraser when stroke width changes
      if (toolbarStore.currentTool === 'eraser') {
        updateCanvasCursor();
      }
    }
  }
);

// Expose canvas loading state for E2E tests
watch(
  isReady,
  (ready) => {
    (window as { isCanvasLoading?: { value: boolean } }).isCanvasLoading = {
      value: !ready
    };
  },
  { immediate: true }
);

// Watch auto-save settings
watch(
  () => autoSaveStore.isEnabled,
  (enabled) => {
    if (enabled) {
      setupAutoSave();
    } else if (debouncedAutoSave) {
      debouncedAutoSave.cancel();
      debouncedAutoSave = null;
    }
  }
);

// Cleanup on unmount
onBeforeUnmount(() => {
  // Remove resize handler
  interface WhiteboardWindow extends Window {
    __whiteboardResizeHandler?: () => void;
  }
  const handleResize = (window as WhiteboardWindow).__whiteboardResizeHandler;
  if (handleResize) {
    window.removeEventListener('resize', handleResize);
    delete (window as WhiteboardWindow).__whiteboardResizeHandler;
  }

  // Perform final auto-save
  if (autoSaveStore.isEnabled && isReady.value) {
    whiteboard.saveState().then((state) => {
      const canvasData = JSON.parse(state);
      autoSaveStore.performAutoSaveImmediately(canvasData);
    });
  }

  // Cleanup handlers
  if (keyboardHandler) {
    keyboardHandler.detach();
    keyboardHandler = null;
  }
  if (clipboardHandler) {
    clipboardHandler.detach();
    clipboardHandler = null;
  }
  if (dragDropHandler) {
    dragDropHandler.detach();
    dragDropHandler = null;
  }
  if (debouncedAutoSave) {
    debouncedAutoSave.cancel();
    debouncedAutoSave = null;
  }

  // Cleanup whiteboard
  whiteboard.cleanup();
});

// Initialize on mount
onMounted(async () => {
  await initializeWhiteboard();

  // Set initial tool
  if (isReady.value && toolManagerRef) {
    whiteboard.setTool(toolbarStore.currentTool as ToolType);
    toolManagerRef.updateConfig({
      color: toolbarStore.color,
      strokeWidth: toolbarStore.strokeWidth,
    });
    // Set initial cursor
    updateCanvasCursor();
  }
});

// Expose methods for parent component
defineExpose({
  clearCanvas,
  getCanvasImage,
});
</script>

<style scoped>
.whiteboard-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}

#whiteboard-canvas {
  display: block;
}
</style>
