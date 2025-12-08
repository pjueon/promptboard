/**
 * Fabric.js canvas JSON state interface
 * Represents the serialized state of a canvas returned by toJSON()
 */
export interface CanvasState {
  version: string;
  objects: object[];
  background?: string | null;
  backgroundImage?: object | null;
  [key: string]: unknown;
}
