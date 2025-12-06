import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

describe('Toast Store', () => {
  beforeEach(async () => {
    // Clear module cache to reset store
    vi.resetModules();
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should start with empty toasts array', async () => {
      const { useToastStore } = await import('../../src/renderer/stores/toastStore');
      const toastStore = useToastStore();
      
      expect(toastStore.toasts).toEqual([]);
    });
  });

  describe('Toast Creation', () => {
    it('should create toast with default type and duration', async () => {
      const { useToastStore } = await import('../../src/renderer/stores/toastStore');
      const toastStore = useToastStore();
      
      const id = toastStore.showToast('Test message');
      
      expect(toastStore.toasts).toHaveLength(1);
      expect(toastStore.toasts[0]).toMatchObject({
        id,
        message: 'Test message',
        type: 'info',
        duration: 3000,
      });
    });

    it('should create toast with custom type and duration', async () => {
      const { useToastStore } = await import('../../src/renderer/stores/toastStore');
      const toastStore = useToastStore();
      
      const id = toastStore.showToast('Error occurred', 'error', 5000);
      
      expect(toastStore.toasts).toHaveLength(1);
      expect(toastStore.toasts[0]).toMatchObject({
        id,
        message: 'Error occurred',
        type: 'error',
        duration: 5000,
      });
    });

    it('should assign unique IDs to toasts', async () => {
      const { useToastStore } = await import('../../src/renderer/stores/toastStore');
      const toastStore = useToastStore();
      
      const id1 = toastStore.showToast('First');
      const id2 = toastStore.showToast('Second');
      const id3 = toastStore.showToast('Third');
      
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(toastStore.toasts).toHaveLength(3);
    });
  });

  describe('Toast Auto-removal', () => {
    it('should auto-remove toast after duration', async () => {
      const { useToastStore } = await import('../../src/renderer/stores/toastStore');
      const toastStore = useToastStore();
      
      toastStore.showToast('Auto remove', 'info', 1000);
      expect(toastStore.toasts).toHaveLength(1);
      
      // Fast-forward time by 1000ms
      vi.advanceTimersByTime(1000);
      
      expect(toastStore.toasts).toHaveLength(0);
    });

    it('should not auto-remove toast with 0 duration', async () => {
      const { useToastStore } = await import('../../src/renderer/stores/toastStore');
      const toastStore = useToastStore();
      
      toastStore.showToast('Persistent', 'info', 0);
      expect(toastStore.toasts).toHaveLength(1);
      
      // Fast-forward time
      vi.advanceTimersByTime(10000);
      
      expect(toastStore.toasts).toHaveLength(1);
    });

    it('should remove multiple toasts independently', async () => {
      const { useToastStore } = await import('../../src/renderer/stores/toastStore');
      const toastStore = useToastStore();
      
      toastStore.showToast('First', 'info', 1000);
      toastStore.showToast('Second', 'info', 2000);
      toastStore.showToast('Third', 'info', 3000);
      
      expect(toastStore.toasts).toHaveLength(3);
      
      // After 1000ms, first toast should be removed
      vi.advanceTimersByTime(1000);
      expect(toastStore.toasts).toHaveLength(2);
      
      // After 2000ms total, second toast should be removed
      vi.advanceTimersByTime(1000);
      expect(toastStore.toasts).toHaveLength(1);
      
      // After 3000ms total, third toast should be removed
      vi.advanceTimersByTime(1000);
      expect(toastStore.toasts).toHaveLength(0);
    });
  });

  describe('Manual Toast Removal', () => {
    it('should remove toast by ID', async () => {
      const { useToastStore } = await import('../../src/renderer/stores/toastStore');
      const toastStore = useToastStore();
      
      const id1 = toastStore.showToast('First', 'info', 0);
      const id2 = toastStore.showToast('Second', 'info', 0);
      const id3 = toastStore.showToast('Third', 'info', 0);
      
      expect(toastStore.toasts).toHaveLength(3);
      
      toastStore.removeToast(id2);
      
      expect(toastStore.toasts).toHaveLength(2);
      expect(toastStore.toasts.find(t => t.id === id2)).toBeUndefined();
      expect(toastStore.toasts.find(t => t.id === id1)).toBeDefined();
      expect(toastStore.toasts.find(t => t.id === id3)).toBeDefined();
    });

    it('should handle removing non-existent toast', async () => {
      const { useToastStore } = await import('../../src/renderer/stores/toastStore');
      const toastStore = useToastStore();
      
      toastStore.showToast('Test');
      expect(toastStore.toasts).toHaveLength(1);
      
      toastStore.removeToast(999); // Non-existent ID
      
      expect(toastStore.toasts).toHaveLength(1);
    });
  });

  describe('Helper Methods', () => {
    it('should create success toast', async () => {
      const { useToastStore } = await import('../../src/renderer/stores/toastStore');
      const toastStore = useToastStore();
      
      toastStore.success('Operation successful');
      
      expect(toastStore.toasts).toHaveLength(1);
      expect(toastStore.toasts[0].type).toBe('success');
      expect(toastStore.toasts[0].message).toBe('Operation successful');
    });

    it('should create error toast', async () => {
      const { useToastStore } = await import('../../src/renderer/stores/toastStore');
      const toastStore = useToastStore();
      
      toastStore.error('Operation failed');
      
      expect(toastStore.toasts).toHaveLength(1);
      expect(toastStore.toasts[0].type).toBe('error');
      expect(toastStore.toasts[0].message).toBe('Operation failed');
    });

    it('should create info toast', async () => {
      const { useToastStore } = await import('../../src/renderer/stores/toastStore');
      const toastStore = useToastStore();
      
      toastStore.info('Information');
      
      expect(toastStore.toasts).toHaveLength(1);
      expect(toastStore.toasts[0].type).toBe('info');
    });

    it('should create warning toast', async () => {
      const { useToastStore } = await import('../../src/renderer/stores/toastStore');
      const toastStore = useToastStore();
      
      toastStore.warning('Warning message');
      
      expect(toastStore.toasts).toHaveLength(1);
      expect(toastStore.toasts[0].type).toBe('warning');
    });

    it('should accept custom duration in helper methods', async () => {
      const { useToastStore } = await import('../../src/renderer/stores/toastStore');
      const toastStore = useToastStore();
      
      toastStore.success('Custom duration', 5000);
      
      expect(toastStore.toasts[0].duration).toBe(5000);
    });
  });

  describe('Clear All Toasts', () => {
    it('should clear all toasts', async () => {
      const { useToastStore } = await import('../../src/renderer/stores/toastStore');
      const toastStore = useToastStore();
      
      toastStore.showToast('First', 'info', 0);
      toastStore.showToast('Second', 'error', 0);
      toastStore.showToast('Third', 'warning', 0);
      
      expect(toastStore.toasts).toHaveLength(3);
      
      toastStore.clear();
      
      expect(toastStore.toasts).toHaveLength(0);
    });

    it('should clear empty toasts array without error', async () => {
      const { useToastStore } = await import('../../src/renderer/stores/toastStore');
      const toastStore = useToastStore();
      
      expect(toastStore.toasts).toHaveLength(0);
      
      toastStore.clear();
      
      expect(toastStore.toasts).toHaveLength(0);
    });
  });
});
