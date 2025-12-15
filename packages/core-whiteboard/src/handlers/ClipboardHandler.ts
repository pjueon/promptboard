import { CanvasManager } from '../core/CanvasManager';
import { HistoryManager } from '../core/HistoryManager';
import { addImageToCanvas } from '../utils/imageUtils';

export interface ClipboardHandlerConfig {
  onPasteImage?: () => void; // Callback after successful paste
  onError?: (error: Error) => void;
}

export class ClipboardHandler {
  private canvasManager: CanvasManager;
  private historyManager: HistoryManager;
  private config: ClipboardHandlerConfig;
  private _boundPasteHandler: (e: ClipboardEvent) => void;

  constructor(
    canvasManager: CanvasManager,
    historyManager: HistoryManager,
    config: ClipboardHandlerConfig = {}
  ) {
    this.canvasManager = canvasManager;
    this.historyManager = historyManager;
    this.config = config;
    this._boundPasteHandler = this.handlePaste.bind(this);
  }

  attach(): void {
    window.addEventListener('paste', this._boundPasteHandler);
  }

  detach(): void {
    window.removeEventListener('paste', this._boundPasteHandler);
  }

  private async handlePaste(e: ClipboardEvent): Promise<void> {
    const items = e.clipboardData?.items;
    const canvas = this.canvasManager.getCanvas();
    
    if (!items || !canvas) return;

    for (let i = 0; i < items.length; i++) {
      // Check if item is an image
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (!blob) continue;

        try {
          // Add image using shared utility
          await addImageToCanvas(canvas, blob);
          
          // Save snapshot
          this.historyManager.saveSnapshot();
          
          if (this.config.onPasteImage) {
            this.config.onPasteImage();
          }
        } catch (err) {
          if (this.config.onError) {
            this.config.onError(err as Error);
          }
        }
        
        break; // Only process first image
      }
    }
  }
}
