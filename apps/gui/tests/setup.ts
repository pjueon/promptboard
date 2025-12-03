// Vitest global setup file
import { vi } from 'vitest';
import { config } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import en from '../src/renderer/i18n/locales/en';
import ko from '../src/renderer/i18n/locales/ko';
import ja from '../src/renderer/i18n/locales/ja';

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
console.error = (...args: any[]) => {
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

// @ts-expect-error
global.window.electron = {
  ipcRenderer: mockIpcRenderer,
};
