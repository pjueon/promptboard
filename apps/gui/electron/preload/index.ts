import { contextBridge, ipcRenderer } from 'electron';
import type { FabricCanvasData } from '../main/whiteboard-state';

export interface AppSettings {
  theme: 'light' | 'dark';
  locale: 'en' | 'ko' | 'ja';
  autoSave: boolean;
  autoSaveDebounceMs: number;
}

export interface WhiteboardState {
  version: string;
  canvasData: FabricCanvasData;
  savedAt: string;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize') as Promise<boolean>,
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized') as Promise<boolean>,
  },
  settings: {
    load: () => ipcRenderer.invoke('settings:load') as Promise<AppSettings>,
    save: (settings: AppSettings) => ipcRenderer.invoke('settings:save', settings) as Promise<boolean>,
  },
  whiteboard: {
    loadState: () => ipcRenderer.invoke('whiteboard:load-state') as Promise<WhiteboardState | null>,
    saveState: (canvasData: FabricCanvasData) => ipcRenderer.invoke('whiteboard:save-state', canvasData) as Promise<boolean>,
    deleteState: () => ipcRenderer.invoke('whiteboard:delete-state') as Promise<boolean>,
  },
});

// Type definition for TypeScript
declare global {
  interface Window {
    electronAPI: {
      window: {
        minimize: () => Promise<void>;
        maximize: () => Promise<boolean>;
        close: () => Promise<void>;
        isMaximized: () => Promise<boolean>;
      };
      settings: {
        load: () => Promise<AppSettings>;
        save: (settings: AppSettings) => Promise<boolean>;
      };
      whiteboard: {
        loadState: () => Promise<WhiteboardState | null>;
        saveState: (canvasData: FabricCanvasData) => Promise<boolean>;
        deleteState: () => Promise<boolean>;
      };
    };
  }
}
