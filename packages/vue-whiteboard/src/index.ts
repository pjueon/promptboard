/**
 * @promptboard/vue-whiteboard
 * Vue wrapper for core-whiteboard engine
 */

// Composables
export { useWhiteboard } from './composables/useWhiteboard';

// Components
export { default as WhiteboardCanvas } from './components/WhiteboardCanvas.vue';

// Types
export type {
  UseWhiteboardConfig,
  UseWhiteboardReturn,
  WhiteboardToolOptions,
} from './types';

// Re-export core-whiteboard types for convenience
export type {
  ToolType,
  ToolConfig,
  Point,
  CanvasState,
} from '@promptboard/core-whiteboard';
