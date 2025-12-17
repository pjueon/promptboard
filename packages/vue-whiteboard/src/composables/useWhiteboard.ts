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

    // Setup automatic snapshot saving on canvas changes
    canvas.on('object:modified', () => {
      if (historyManager && !historyManager.isRestoringSnapshot()) {
        setTimeout(() => {
          historyManager!.saveSnapshot();
        }, 10);
      }
    });

    // Note: object:added is NOT used because tools handle snapshot saving
    // via their onSnapshotSave callback after setting selectable: true

    isReady.value = true;
  }

  /**
   * Cleanup resources
   */
  function cleanup(): void {
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

    if (historyManager) {
      historyManager.clear();
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
