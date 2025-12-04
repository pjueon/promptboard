// Mock canvas module to avoid native module loading issues in test environment
import { vi } from 'vitest';

// Log to help verify mock is being used
console.log('🎨 [CANVAS MOCK] Canvas mock is active');

export const createCanvas = vi.fn(() => ({
  getContext: vi.fn(() => ({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(),
    putImageData: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
  })),
  toBuffer: vi.fn(() => Buffer.from([])),
  toDataURL: vi.fn(() => 'data:image/png;base64,'),
  width: 800,
  height: 600,
}));

export const createImageData = vi.fn(() => ({
  data: new Uint8ClampedArray(),
  width: 0,
  height: 0
}));

export const loadImage = vi.fn(() => Promise.resolve({
  width: 100,
  height: 100,
}));

export default {
  createCanvas,
  createImageData,
  loadImage,
};
