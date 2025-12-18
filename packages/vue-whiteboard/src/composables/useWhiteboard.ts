import { ref, type Ref } from 'vue';
import { fabric } from 'fabric';
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
  registerArrowObject,
  KeyboardHandler,
  ClipboardHandler,
  DragDropHandler,
  type ToolType,
  type ToolConfig,
} from '@promptboard/core-whiteboard';
import type { UseWhiteboardConfig, UseWhiteboardReturn } from '../types';

/**
 * Vue composable for managing whiteboard functionality
 * Provides reactive state and methods for canvas operations
 */
export function useWhiteboard(): UseWhiteboardReturn {
  // Canvas reference
  const canvasRef: Ref<HTMLCanvasElement | null> = ref(null);

  // State
  const isReady = ref(false);
  const currentTool: Ref<ToolType | null> = ref(null);
  const canUndo = ref(false);
  const canRedo = ref(false);

  // Managers
  let canvasManager: CanvasManager | null = null;
  let toolManager: ToolManager | null = null;
  let historyManager: HistoryManager | null = null;

  // Handlers
  let keyboardHandler: KeyboardHandler | null = null;
  let clipboardHandler: ClipboardHandler | null = null;
  let dragDropHandler: DragDropHandler | null = null;

  // Tool options
  let toolOptions: ToolConfig = {
    color: '#000000',
    strokeWidth: 2,
  };

  // Event handlers
  const toolChangeHandlers: Array<(tool: ToolType) => void> = [];
  const historyChangeHandlers: Array<() => void> = [];

  /**
   * Register custom Fabric.js objects
   */
  function registerCustomObjects() {
    registerEditableLine();
    registerArrowObject();
  }

  /**
   * Initialize the whiteboard
   */
  async function initialize(config: UseWhiteboardConfig): Promise<void> {
    if (!canvasRef.value) {
      throw new Error('Canvas element is required');
    }

    // Register custom objects first
    registerCustomObjects();

    // Initialize managers
    canvasManager = new CanvasManager(canvasRef.value, {
      width: config.width,
      height: config.height,
      backgroundColor: config.backgroundColor,
    });

    const canvas = canvasManager.getCanvas();

    // Initialize tool manager
    toolManager = new ToolManager(canvas, toolOptions);

    // Callbacks for tools
    const saveSnapshot = () => {
      if (historyManager && !historyManager.isRestoringSnapshot()) {
        historyManager.saveSnapshot();
      }
    };

    const switchToSelect = () => {
      setTool('select');
    };

    // Register all tools
    toolManager.registerTool('pen', new PenTool(canvas, toolOptions, saveSnapshot));
    toolManager.registerTool('line', new LineTool(canvas, toolOptions, saveSnapshot, switchToSelect));
    toolManager.registerTool('arrow', new ArrowTool(canvas, toolOptions, saveSnapshot, switchToSelect));
    toolManager.registerTool('rectangle', new RectangleTool(canvas, toolOptions, saveSnapshot, switchToSelect));
    toolManager.registerTool('ellipse', new EllipseTool(canvas, toolOptions, saveSnapshot, switchToSelect));
    toolManager.registerTool('text', new TextTool(canvas, toolOptions, saveSnapshot));
    toolManager.registerTool('eraser', new EraserTool(canvas, toolOptions, saveSnapshot));
    toolManager.registerTool('select', new SelectTool(canvas, toolOptions));

    // Initialize history manager
    historyManager = new HistoryManager(canvasManager, {
      maxHistory: 50,
      propertiesToInclude: ['arrowId', 'selectable', 'evented'],
    });
    historyManager.on('change', () => {
      canUndo.value = historyManager!.canUndo();
      canRedo.value = historyManager!.canRedo();
      historyChangeHandlers.forEach((handler) => handler());
    });

    // Initialize event handlers
    keyboardHandler = new KeyboardHandler(
      canvasManager,
      historyManager,
      toolManager,
      {
        onSave: () => {
          window.dispatchEvent(new Event('save-canvas-shortcut'));
        },
        onBrushSizeChange: (delta: number) => {
          const newWidth = Math.max(1, Math.min(20, toolOptions.strokeWidth + delta));
          setToolOptions({ strokeWidth: newWidth });
        },
        onDelete: () => {
          // Check if SelectTool has a selection rectangle
          const selectTool = toolManager?.getTool('select');
          if (selectTool && typeof (selectTool as any).getSelectionRect === 'function') {
            const selectionRect = (selectTool as any).getSelectionRect();
            if (selectionRect) {
              // Region selection exists - cover it with a white rectangle
              const left = selectionRect.left!;
              const top = selectionRect.top!;
              const width = selectionRect.width!;
              const height = selectionRect.height!;

              // Skip if selection is too small
              if (width < 1 || height < 1) {
                // Just remove the selection rectangle
                if (typeof (selectTool as any).removeSelectionRect === 'function') {
                  (selectTool as any).removeSelectionRect();
                }
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

              // Remove selection rectangle
              if (typeof (selectTool as any).removeSelectionRect === 'function') {
                (selectTool as any).removeSelectionRect();
              }

              // Add white rectangle to cover the area
              canvas.add(whiteRect);
              canvas.renderAll();
              historyManager?.saveSnapshot();
              return;
            }
          }

          // No region selection - delete selected objects
          const activeObject = canvas.getActiveObject();
          if (!activeObject) return;

          if (activeObject.type === 'activeSelection') {
            // Handle group selection
            (activeObject as fabric.ActiveSelection).getObjects().forEach((obj) => {
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
          historyManager?.saveSnapshot();
        },
      }
    );
    keyboardHandler.attach();

    clipboardHandler = new ClipboardHandler(canvasManager, historyManager);
    clipboardHandler.attach();

    dragDropHandler = new DragDropHandler(canvasManager, historyManager);
    // DragDropHandler needs container element. We can use the canvas wrapper.
    // canvasRef.value is the canvas element. canvasManager creates a wrapper?
    // Fabric puts canvas in a wrapper .canvas-container.
    // DragDropHandler attach takes an HTMLElement.
    // Let's attach to the canvas element's parent.
    if (canvasRef.value.parentElement) {
      dragDropHandler.attach(canvasRef.value.parentElement);
    } else {
      dragDropHandler.attach(canvasRef.value);
    }

    // Setup automatic snapshot saving on canvas changes
    canvas.on('object:modified', (e: fabric.IEvent) => {
      if (historyManager && !historyManager.isRestoringSnapshot()) {
        // Skip if the modified object is a text being edited
        const target = e.target;
        if (target) {
          // @ts-expect-error - custom property
          if (target.isTextTool === true) {
            return; // Text tool handles its own snapshot
          }
        }

        setTimeout(() => {
          historyManager!.saveSnapshot();
        }, 10);
      }
    });

    // Note: object:added is NOT used because tools handle snapshot saving
    // via their onSnapshotSave callback after setting selectable: true

    // Setup path:created event for pen and eraser tools
    canvas.on('path:created', (e: fabric.IEvent & { path?: fabric.Path }) => {
      if (!e.path) return;

      // Apply strokeUniform to prevent stroke width scaling
      // Keep path non-selectable to match flattened behavior
      e.path.set({
        strokeUniform: true,
        selectable: false,
        evented: false,
      });

      canvas.renderAll();

      // Save snapshot after path is created (without selection)
      setTimeout(() => {
        if (historyManager && !historyManager.isRestoringSnapshot()) {
          historyManager.saveSnapshot();
        }
      }, 50);
    });

    // Helper function to restore selection state after undo/redo
    const restoreSelectionAfterHistoryNav = () => {
      if (!canvas) return;

      // Find all objects that are selectable (only active objects are selectable)
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
    historyManager.on('undo', () => {
      restoreSelectionAfterHistoryNav();
    });
    historyManager.on('redo', () => {
      restoreSelectionAfterHistoryNav();
    });

    // Register selection:cleared event to make deselected objects non-selectable
    canvas.on('selection:cleared', (e: fabric.IEvent) => {
      if (historyManager?.isRestoringSnapshot()) return; // Skip during undo/redo
      if (toolManager?.isDrawing()) return; // Skip while user is actively drawing

      const deselected = (e as fabric.IEvent & { deselected?: fabric.Object[] }).deselected;
      if (deselected && deselected.length > 0) {
        // Check if any deselected object is a text being edited
        const hasTextToolObject = deselected.some((obj) => {
          // @ts-expect-error - custom property
          return obj.isTextTool === true;
        });

        // Skip snapshot if text tool object is being deselected
        // (text tool handles its own snapshot on editing:exited)
        if (hasTextToolObject) {
          return;
        }

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
        historyManager?.saveSnapshot();
      }
    });

    isReady.value = true;
  }

  /**
   * Cleanup resources
   */
  function cleanup(): void {
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

    if (historyManager) {
      historyManager.dispose();
      historyManager = null;
    }

    if (canvasManager) {
      canvasManager.dispose();
      canvasManager = null;
    }

    toolManager = null;

    isReady.value = false;
    currentTool.value = null;
    canUndo.value = false;
    canRedo.value = false;
  }

  /**
   * Set the active tool
   */
  function setTool(tool: ToolType): void {
    if (!toolManager) {
      throw new Error('Whiteboard not initialized');
    }

    toolManager.activateTool(tool);
    currentTool.value = tool;

    // Notify listeners
    toolChangeHandlers.forEach((handler) => handler(tool));
  }

  /**
   * Set tool options
   */
  function setToolOptions(options: Partial<ToolConfig>): void {
    toolOptions = { ...toolOptions, ...options };

    if (toolManager) {
      toolManager.updateConfig(options);
    }
  }

  /**
   * Get current tool options
   */
  function getToolOptions(): ToolConfig {
    return { ...toolOptions };
  }

  /**
   * Undo the last action
   */
  function undo(): void {
    if (!historyManager) {
      throw new Error('Whiteboard not initialized');
    }

    historyManager.undo();
  }

  /**
   * Redo the last undone action
   */
  function redo(): void {
    if (!historyManager) {
      throw new Error('Whiteboard not initialized');
    }

    historyManager.redo();
  }

  /**
   * Save canvas state to JSON string
   */
  async function saveState(): Promise<string> {
    if (!canvasManager) {
      throw new Error('Whiteboard not initialized');
    }

    const state = canvasManager.toJSON();
    return JSON.stringify(state);
  }

  /**
   * Load canvas state from JSON string
   */
  async function loadState(state: string): Promise<void> {
    if (!canvasManager) {
      throw new Error('Whiteboard not initialized');
    }

    return new Promise((resolve) => {
      const parsedState = JSON.parse(state);
      canvasManager!.loadFromJSON(parsedState, () => {
        resolve();
      });
    });
  }

  /**
   * Clear the canvas
   */
  function clear(): void {
    if (!canvasManager) {
      throw new Error('Whiteboard not initialized');
    }

    const canvas = canvasManager.getCanvas();
    canvas.clear();
    canvas.renderAll();

    // Save snapshot after clearing so undo can restore
    if (historyManager && !historyManager.isRestoringSnapshot()) {
      historyManager.saveSnapshot();
    }
  }

  /**
   * Get the underlying Fabric.js canvas
   */
  function getCanvas(): fabric.Canvas | null {
    return canvasManager ? canvasManager.getCanvas() : null;
  }

  /**
   * Resize the canvas
   */
  function resize(width: number, height: number): void {
    if (!canvasManager) {
      throw new Error('Whiteboard not initialized');
    }

    canvasManager.resize(width, height);
  }

  /**
   * Register a tool change handler
   */
  function onToolChange(handler: (tool: ToolType) => void): void {
    toolChangeHandlers.push(handler);
  }

  /**
   * Register a history change handler
   */
  function onHistoryChange(handler: () => void): void {
    historyChangeHandlers.push(handler);
  }

  /**
   * Get internal managers (for advanced use cases like custom handlers)
   * @internal
   */
  function getManagers() {
    return {
      canvasManager,
      toolManager,
      historyManager,
    };
  }

  return {
    // Canvas reference
    canvasRef,

    // State
    isReady,
    currentTool,
    canUndo,
    canRedo,

    // Initialization
    initialize,
    cleanup,

    // Tool management
    setTool,
    setToolOptions,
    getToolOptions,

    // History management
    undo,
    redo,

    // State management
    saveState,
    loadState,
    clear,

    // Canvas access
    getCanvas,
    resize,

    // Event handlers
    onToolChange,
    onHistoryChange,

    // Internal managers (advanced use)
    getManagers,
  };
}
