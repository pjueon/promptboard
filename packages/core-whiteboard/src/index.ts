/**
 * @promptboard/core-whiteboard
 * Framework-agnostic whiteboard engine powered by Fabric.js
 */

// Core managers
export { CanvasManager } from './core/CanvasManager';
export type { CanvasManagerConfig } from './core/CanvasManager';
export { ToolManager } from './core/ToolManager';
export { HistoryManager } from './core/HistoryManager';
export type { HistoryManagerConfig, HistoryEvent, HistoryEventType } from './core/HistoryManager';
export { StateManager } from './core/StateManager';
export type { StateManagerConfig, StorageAdapter } from './core/StateManager';

// Tools
export { Tool } from './tools/base/Tool';
export { ShapeTool } from './tools/base/ShapeTool';
export { ConstrainedShapeTool } from './tools/base/ConstrainedShapeTool';
export { LineTool } from './tools/LineTool';
export { ArrowTool } from './tools/ArrowTool';
export { RectangleTool } from './tools/RectangleTool';
export { EllipseTool } from './tools/EllipseTool';
export { TextTool } from './tools/TextTool';
export { PenTool } from './tools/PenTool';
export { EraserTool } from './tools/EraserTool';
export { SelectTool } from './tools/SelectTool';

// Fabric objects
export { EditableLine, registerEditableLine } from './fabric-objects/EditableLine';

// Types
export type {
  ToolType,
  Point,
  ToolConfig,
  CanvasState,
  MouseEvent,
  SnapshotCallback,
  CleanupFunction,
} from './types/index';
