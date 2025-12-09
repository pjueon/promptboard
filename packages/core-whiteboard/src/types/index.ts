import type { fabric } from 'fabric';

/**
 * Tool type identifiers
 */
export type ToolType =
  | 'select'
  | 'pen'
  | 'eraser'
  | 'line'
  | 'arrow'
  | 'rectangle'
  | 'ellipse'
  | 'text';

/**
 * Point in 2D space
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Tool configuration options
 */
export interface ToolConfig {
  color: string;
  strokeWidth: number;
  fontSize?: number;
}

/**
 * Canvas state for serialization
 */
export interface CanvasState {
  version: string;
  objects: unknown[];
  background?: string;
  [key: string]: unknown;
}

/**
 * Mouse event from Fabric.js
 */
export interface MouseEvent {
  pointer?: Point;
  e?: Event;
  target?: fabric.Object;
}

/**
 * Callback function types
 */
export type SnapshotCallback = () => void;
export type CleanupFunction = () => void;
