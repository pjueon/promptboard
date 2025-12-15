import { fabric } from 'fabric';

/**
 * Options for adding an image to the canvas
 */
export interface AddImageOptions {
  position?: { x: number; y: number }; // Center if undefined
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * Add an image from a Blob/File to the canvas
 * @param canvas Fabric canvas instance
 * @param blob Image blob or file
 * @param options Placement options
 * @returns Promise resolving to the added fabric.Image
 */
export function addImageToCanvas(
  canvas: fabric.Canvas,
  blob: Blob,
  options: AddImageOptions = {}
): Promise<fabric.Image> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      
      fabric.Image.fromURL(dataUrl, (img) => {
        if (!img || !canvas) {
          reject(new Error('Failed to load image'));
          return;
        }
        
        // Scale image to fit constraints (default: 80% of canvas)
        const maxWidth = options.maxWidth || (canvas.width || 800) * 0.8;
        const maxHeight = options.maxHeight || (canvas.height || 600) * 0.8;
        
        if ((img.width || 0) > maxWidth || (img.height || 0) > maxHeight) {
          const scale = Math.min(
            maxWidth / (img.width || 1),
            maxHeight / (img.height || 1)
          );
          img.scale(scale);
        }
        
        // Position image
        if (options.position) {
          img.set({
            left: options.position.x,
            top: options.position.y,
            originX: 'center',
            originY: 'center',
          });
        } else {
          // Center
          img.set({
            left: (canvas.width || 0) / 2,
            top: (canvas.height || 0) / 2,
            originX: 'center',
            originY: 'center',
          });
        }
        
        // Add to canvas
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        
        resolve(img);
      });
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(blob);
  });
}
