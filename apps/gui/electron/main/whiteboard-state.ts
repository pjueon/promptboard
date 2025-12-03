import fs from 'fs';
import path from 'path';
import { app } from 'electron';


export type FabricCanvasData = unknown;

export interface WhiteboardState {
  version: string;
  canvasData: FabricCanvasData; // Fabric.js JSON data
  savedAt: string; // ISO timestamp
}

/**
 * Get whiteboard state file path
 * Stored next to the executable for portability
 */
function getWhiteboardStatePath(): string {
  // In development, use app.getPath('userData')
  // In production, use executable directory for portability
  if (app.isPackaged) {
    // Production: Store in executable directory
    const exePath = process.execPath;
    const exeDir = path.dirname(exePath);
    return path.join(exeDir, 'whiteboard-state.json');
  } else {
    // Development: Use userData directory
    return path.join(app.getPath('userData'), 'whiteboard-state.json');
  }
}

/**
 * Load whiteboard state from file
 */
export function loadWhiteboardState(): WhiteboardState | null {
  const statePath = getWhiteboardStatePath();

  try {
    if (fs.existsSync(statePath)) {
      const data = fs.readFileSync(statePath, 'utf-8');
      const state = JSON.parse(data);

      // Validate state structure
      if (state.version && state.canvasData && state.savedAt) {
        return state;
      }
    }
  } catch (error) {
    console.error('Failed to load whiteboard state:', error);
  }

  return null;
}

/**
 * Save whiteboard state to file
 */
export function saveWhiteboardState(canvasData: FabricCanvasData): boolean {
  const statePath = getWhiteboardStatePath();

  try {
    const state: WhiteboardState = {
      version: '1.0.0',
      canvasData,
      savedAt: new Date().toISOString(),
    };

    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Failed to save whiteboard state:', error);
    return false;
  }
}

/**
 * Delete whiteboard state file
 */
export function deleteWhiteboardState(): boolean {
  const statePath = getWhiteboardStatePath();

  try {
    if (fs.existsSync(statePath)) {
      fs.unlinkSync(statePath);
    }
    return true;
  } catch (error) {
    console.error('Failed to delete whiteboard state:', error);
    return false;
  }
}
