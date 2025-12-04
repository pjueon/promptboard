// Vitest global setup file
import { config } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import en from '../src/renderer/i18n/locales/en';
import ko from '../src/renderer/i18n/locales/ko';
import ja from '../src/renderer/i18n/locales/ja';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Mock fabric module with proper constructor functions
// Note: Using 'any' here is acceptable for test mocks that simulate external libraries
// vitest-canvas-mock is loaded via vitest.config.ts setupFiles
const mockObjects: unknown[] = [];

const mockCanvasPrototype = {
  on: function(this: any, event: string, handler: (...args: unknown[]) => void) { 
    if (!this._eventHandlers) this._eventHandlers = {};
    if (!this._eventHandlers[event]) this._eventHandlers[event] = [];
    this._eventHandlers[event].push(handler);
    return this; 
  },
  off: function(this: any, event: string, handler?: (...args: unknown[]) => void) { 
    if (!this._eventHandlers || !this._eventHandlers[event]) return this;
    if (handler) {
      const index = this._eventHandlers[event].indexOf(handler);
      if (index > -1) this._eventHandlers[event].splice(index, 1);
    } else {
      this._eventHandlers[event] = [];
    }
    return this; 
  },
  dispose: function(this: any) {},
  setDimensions: function(this: any) { return this; },
  renderAll: function(this: any) {},
  toJSON: function(this: any) { return { version: '5.3.0', objects: mockObjects }; },
  getObjects: function(this: any) { return mockObjects; },
  remove: function(this: any, obj: unknown) {
    const index = mockObjects.indexOf(obj);
    if (index > -1) mockObjects.splice(index, 1);
  },
  add: function(this: any, obj: unknown) { mockObjects.push(obj); },
  clear: function(this: any) { mockObjects.length = 0; },
  toDataURL: function(this: any) { return 'data:image/png;base64,....'; },
  setActiveObject: function(this: any) {},
  discardActiveObject: function(this: any) {},
  getActiveObject: function(this: any) { return mockObjects[mockObjects.length - 1]; },
  setBackgroundImage: function(this: any, img: unknown, callback?: () => void) {
    if (callback) callback();
  },
};

function MockCanvas(this: any, element?: unknown, options?: Record<string, unknown>) {
  this.isDrawingMode = false;
  this.selection = true;
  this.defaultCursor = 'default';
  this.hoverCursor = 'default';
  this.freeDrawingCursor = 'crosshair';
  this.freeDrawingBrush = { color: '#000000', width: 1 };
  this.width = options?.width || 1920;
  this.height = options?.height || 1080;
  this.lowerCanvasEl = { 
    getContext: function() { 
      return { clearRect: function() {}, fillRect: function() {} }; 
    }, 
    style: {}, 
    width: this.width, 
    height: this.height 
  };
  this.upperCanvasEl = { 
    getContext: function() { 
      return { clearRect: function() {}, fillRect: function() {} }; 
    }, 
    style: {}, 
    width: this.width, 
    height: this.height 
  };
  this._eventHandlers = {};
  Object.assign(this, mockCanvasPrototype);
}

function MockPencilBrush(this: any) {
  this.color = '#000000';
  this.width = 1;
}

function MockLine(this: any, points: unknown, options: Record<string, unknown>) {
  this.type = 'line';
  this.points = points;
  Object.assign(this, options);
  this.on = function() { return this; };
  this.off = function() { return this; };
}

function MockRect(this: any, options: Record<string, unknown>) {
  this.type = 'rect';
  Object.assign(this, options);
  this.on = function() { return this; };
  this.off = function() { return this; };
}

function MockCircle(this: any, options: Record<string, unknown>) {
  this.type = 'circle';
  Object.assign(this, options);
  this.on = function() { return this; };
  this.off = function() { return this; };
}

function MockIText(this: any, text: string, options: Record<string, unknown>) {
  this.type = 'i-text';
  this.text = text;
  Object.assign(this, options);
  this.on = function() { return this; };
  this.off = function() { return this; };
}

const MockImage = {
  fromURL: function(_url: string, callback: (img: Record<string, unknown>) => void) {
    const mockImg = {
      width: 1024,
      height: 768,
      scale: function() { return this; },
      set: function() { return this; },
      on: function() { return this; },
      off: function() { return this; },
    };
    if (callback) {
      callback(mockImg);
    }
    return mockImg;
  },
};
/* eslint-enable @typescript-eslint/no-explicit-any */

// Use vi.mock at module level
import { vi } from 'vitest';

vi.mock('fabric', () => {
  return {
    fabric: {
      Canvas: MockCanvas,
      PencilBrush: MockPencilBrush,
      Line: MockLine,
      Rect: MockRect,
      Circle: MockCircle,
      IText: MockIText,
      Image: MockImage,
      Object: {
        prototype: {
          controls: { mtr: {} },
        },
      },
    },
  };
});


// --- Vue i18n and other setups ---
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en, ko, ja },
});

config.global.plugins = [i18n];
