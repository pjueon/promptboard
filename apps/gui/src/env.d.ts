/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

declare const __APP_VERSION__: string;

// Augment the Window interface for E2E testing
declare global {
  interface Window {
    fabricCanvas?: import('fabric').Canvas;
    historyManager?: import('@promptboard/core-whiteboard').HistoryManager;
    undoRedoState?: {
      canUndo: import('vue').Ref<boolean>;
      canRedo: import('vue').Ref<boolean>;
    };
    toolbarStore?: import('./stores/toolbarStore').ToolbarStore; // Reference to the toolbar store
  }
}