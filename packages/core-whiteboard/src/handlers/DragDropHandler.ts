import { CanvasManager } from '../core/CanvasManager';
import { HistoryManager } from '../core/HistoryManager';
import { addImageToCanvas } from '../utils/imageUtils';

export interface DragDropHandlerConfig {
  onDropImage?: () => void;
  onError?: (error: Error) => void;
}

export class DragDropHandler {
  private canvasManager: CanvasManager;
  private historyManager: HistoryManager;
  private config: DragDropHandlerConfig;
  private targetElement: HTMLElement | null = null;
  
  private _boundDragOverHandler: (e: DragEvent) => void;
  private _boundDropHandler: (e: DragEvent) => void;

  constructor(
    canvasManager: CanvasManager,
    historyManager: HistoryManager,
    config: DragDropHandlerConfig = {}
  ) {
    this.canvasManager = canvasManager;
    this.historyManager = historyManager;
    this.config = config;
    
    this._boundDragOverHandler = this.handleDragOver.bind(this);
    this._boundDropHandler = this.handleDrop.bind(this);
  }

  attach(element: HTMLElement): void {
    this.targetElement = element;
    element.addEventListener('dragover', this._boundDragOverHandler);
    element.addEventListener('drop', this._boundDropHandler);
  }

  detach(): void {
    if (this.targetElement) {
      this.targetElement.removeEventListener('dragover', this._boundDragOverHandler);
      this.targetElement.removeEventListener('drop', this._boundDropHandler);
      this.targetElement = null;
    }
  }

  private handleDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  private async handleDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer?.files;
    const canvas = this.canvasManager.getCanvas();
    
    if (!files || !canvas) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (file.type.indexOf('image') !== -1) {
        try {
          // Calculate position
          let position: { x: number; y: number } | undefined;
          
          if (this.targetElement) {
            const rect = this.targetElement.getBoundingClientRect();
            position = {
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            };
          }

          await addImageToCanvas(canvas, file, { position });
          
          this.historyManager.saveSnapshot();
          
          if (this.config.onDropImage) {
            this.config.onDropImage();
          }
        } catch (err) {
          if (this.config.onError) {
            this.config.onError(err as Error);
          }
        }
        
        break; // Process first image only
      }
    }
  }
}
