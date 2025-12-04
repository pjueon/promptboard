// Vitest global setup file
import { vi } from 'vitest';
import { config } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import en from '../src/renderer/i18n/locales/en';
import ko from '../src/renderer/i18n/locales/ko';
import ja from '../src/renderer/i18n/locales/ja';

// Log to verify this file is being loaded
console.log('🔧 [TEST SETUP] Test setup file loaded');

// Proactively block canvas.node loading by putting it in module cache FIRST
// This must happen before any code tries to load canvas
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Module = require('node:module');

const canvasMock = {
  createCanvas: vi.fn(() => ({
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
  })),
  createImageData: vi.fn(() => ({
    data: new Uint8ClampedArray(),
    width: 0,
    height: 0
  })),
  loadImage: vi.fn(() => Promise.resolve({
    width: 100,
    height: 100,
  })),
};

// Try to preload canvas into module cache
// This prevents the real canvas.node from being loaded
try {
  // Try to resolve canvas path first
  const canvasPath = require.resolve('canvas');
  Module._cache[canvasPath] = {
    id: canvasPath,
    exports: canvasMock,
    loaded: true,
    filename: canvasPath,
    children: [],
  };
  console.log('✅ [CANVAS MOCK] Preloaded canvas mock into module cache');
} catch (e) {
  // Canvas not installed - this is fine, mock will still work via vi.mock
  console.log('ℹ️ [CANVAS MOCK] Canvas not found in node_modules (this is expected locally)');
}

// Mock canvas module to prevent native module loading issues in test environment
// This is necessary because:
// 1. Fabric.js may try to use Node.js canvas in some environments
// 2. The native canvas.node binary may not be compatible with the CI environment
// 3. Unit tests don't need real canvas functionality

// Patch Node.js require to intercept canvas module loading attempts
// This handles dynamic require() calls that vi.mock() cannot catch
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id: string, ...args: unknown[]) {
  if (id === 'canvas') {
    // Return a mock that satisfies canvas API requirements
    return {
      createCanvas: vi.fn(() => ({
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
      })),
      createImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(),
        width: 0,
        height: 0
      })),
      loadImage: vi.fn(() => Promise.resolve({
        width: 100,
        height: 100,
      })),
    };
  }
  return originalRequire.apply(this, [id, ...args]);
};

// Also use vi.mock for static imports (though canvas is typically not imported directly)
vi.mock('canvas', () => {
  return {
    createCanvas: vi.fn(() => ({
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
    })),
    createImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(),
      width: 0,
      height: 0
    })),
    loadImage: vi.fn(() => Promise.resolve({
      width: 100,
      height: 100,
    })),
  };
});

// Create i18n instance
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en,
    ko,
    ja,
  },
});

// Configure global plugins
config.global.plugins = [i18n];

// Filter console.error (suppress specific messages only)
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const message = args[0]?.toString() || '';

  // Suppress WebSocketBridge connect/disconnect logs
  if (message.includes('Connected to MCP bridge server') ||
      message.includes('Disconnected from MCP bridge server')) {
    return;
  }

  // Suppress Canvas error test logs
  if (message.includes('Error converting canvas to image')) {
    return;
  }

  // Output everything else normally
  originalConsoleError.apply(console, args);
};

// Electron mock object
global.window = global.window || {};

// IPC communication mock
const mockIpcRenderer = {
  invoke: vi.fn(),
  on: vi.fn(),
  send: vi.fn(),
  removeListener: vi.fn(),
};

// @ts-expect-error - window.electron is not typed but required for testing
global.window.electron = {
  ipcRenderer: mockIpcRenderer,
};
