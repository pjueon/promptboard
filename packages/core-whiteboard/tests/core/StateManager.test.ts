import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StateManager, type StorageAdapter } from '../../src/core/StateManager';
import { CanvasManager } from '../../src/core/CanvasManager';
import { HistoryManager } from '../../src/core/HistoryManager';
import type { CanvasState } from '../../src/types';

// Mock CanvasManager
vi.mock('../../src/core/CanvasManager', () => {
  return {
    CanvasManager: vi.fn(function() {
      return {
        toJSON: vi.fn().mockReturnValue({ version: '5.3.0', objects: [] }),
        loadFromJSON: vi.fn().mockImplementation((json, callback) => callback && callback()),
      };
    }),
  };
});

// Mock HistoryManager
vi.mock('../../src/core/HistoryManager', () => {
  return {
    HistoryManager: vi.fn(function() {
      return {
        on: vi.fn().mockReturnValue(() => {}),
        off: vi.fn(),
      };
    }),
  };
});

describe('StateManager', () => {
  let stateManager: StateManager;
  let canvasManager: CanvasManager;
  let historyManager: HistoryManager;
  let storageAdapter: StorageAdapter;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mocks
    canvasManager = new CanvasManager(document.createElement('canvas'), { width: 800, height: 600 });
    historyManager = new HistoryManager(canvasManager);
    
    // Mock storage adapter
    storageAdapter = {
      save: vi.fn().mockResolvedValue(undefined),
      load: vi.fn().mockResolvedValue({ version: '5.3.0', objects: [] }),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    // Initialize StateManager
    stateManager = new StateManager(canvasManager, historyManager, {
      storageAdapter,
      autoSave: true,
      debounceMs: 100, // Short debounce for testing
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should be initialized with default config', () => {
    expect(stateManager).toBeDefined();
  });

  it('should save state using storage adapter', async () => {
    const mockState = { version: '5.3.0', objects: [] };
    // @ts-ignore
    canvasManager.toJSON.mockReturnValue(mockState);

    await stateManager.save();

    expect(canvasManager.toJSON).toHaveBeenCalledWith([]);
    expect(storageAdapter.save).toHaveBeenCalledWith(mockState);
  });

  it('should load state using storage adapter', async () => {
    const mockState = { version: '5.3.0', objects: [{ type: 'rect' }] };
    // @ts-ignore
    storageAdapter.load.mockResolvedValue(mockState);

    const loadedState = await stateManager.load();

    expect(storageAdapter.load).toHaveBeenCalled();
    expect(canvasManager.loadFromJSON).toHaveBeenCalledWith(mockState, expect.any(Function));
    expect(loadedState).toEqual(mockState);
  });

  it('should return null if storage adapter returns null on load', async () => {
    // @ts-ignore
    storageAdapter.load.mockResolvedValue(null);

    const loadedState = await stateManager.load();

    expect(storageAdapter.load).toHaveBeenCalled();
    expect(canvasManager.loadFromJSON).not.toHaveBeenCalled();
    expect(loadedState).toBeNull();
  });

  it('should auto-save on history change with debounce', async () => {
    vi.useFakeTimers();
    
    // Setup event handlers
    let listener: any;
    // @ts-ignore
    historyManager.on.mockImplementation((event, fn) => {
      listener = fn;
      return () => {};
    });

    // Re-initialize to attach listeners
    stateManager = new StateManager(canvasManager, historyManager, {
      storageAdapter,
      autoSave: true,
      debounceMs: 500,
    });

    // Trigger history change
    if (listener) listener({ type: 'change' });

    // Should not save immediately
    expect(storageAdapter.save).not.toHaveBeenCalled();

    // Advance time
    vi.advanceTimersByTime(500);

    // Should save now
    expect(storageAdapter.save).toHaveBeenCalled();
  });

  it('should not auto-save if disabled', async () => {
    vi.useFakeTimers();
    
    // Setup event handlers
    let listener: any;
    // @ts-ignore
    historyManager.on.mockImplementation((event, fn) => {
      listener = fn;
      return () => {};
    });

    // Re-initialize with autoSave: false
    stateManager = new StateManager(canvasManager, historyManager, {
      storageAdapter,
      autoSave: false,
      debounceMs: 500,
    });

    // Trigger history change
    if (listener) listener({ type: 'change' });

    // Advance time
    vi.advanceTimersByTime(500);

    // Should not save
    expect(storageAdapter.save).not.toHaveBeenCalled();
  });
});
