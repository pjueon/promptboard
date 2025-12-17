import type { Ref } from 'vue';
import type { fabric } from 'fabric';
import type {
  ToolType,
  ToolConfig,
  CanvasManager,
  ToolManager,
  HistoryManager,
} from '@promptboard/core-whiteboard';

/**
 * Configuration for useWhiteboard composable
 */
export interface UseWhiteboardConfig {
  width: number;
  height: number;
  backgroundColor?: string;
}

/**
 * Return type of useWhiteboard composable
 */
export interface UseWhiteboardReturn {
  // Canvas reference
  canvasRef: Ref<HTMLCanvasElement | null>;

  // State
  isReady: Ref<boolean>;
  currentTool: Ref<ToolType | null>;
  canUndo: Ref<boolean>;
  canRedo: Ref<boolean>;

  // Initialization
  initialize: (config: UseWhiteboardConfig) => Promise<void>;
  cleanup: () => void;

  // Tool management
  setTool: (tool: ToolType) => void;
  setToolOptions: (options: Partial<ToolConfig>) => void;
  getToolOptions: () => ToolConfig;

  // History management
  undo: () => void;
  redo: () => void;

  // State management
  saveState: () => Promise<string>;
  loadState: (state: string) => Promise<void>;
  clear: () => void;

  // Canvas access
  getCanvas: () => fabric.Canvas | null;
  resize: (width: number, height: number) => void;

  // Event handlers
  onToolChange: (handler: (tool: ToolType) => void) => void;
  onHistoryChange: (handler: () => void) => void;

  // Internal managers (advanced use)
  getManagers: () => {
    canvasManager: CanvasManager | null;
    toolManager: ToolManager | null;
    historyManager: HistoryManager | null;
  };
}

/**
 * Tool options that can be configured
 */
export interface WhiteboardToolOptions extends ToolConfig {}
