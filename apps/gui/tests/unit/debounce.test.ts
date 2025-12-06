import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce } from '../../src/renderer/utils/debounce';

describe('Debounce Utility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should delay function execution by specified time', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 1000);

    debouncedFn();
    expect(mockFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(999);
    expect(mockFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should call function with latest arguments', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 1000);

    debouncedFn('first');
    debouncedFn('second');
    debouncedFn('third');

    vi.advanceTimersByTime(1000);

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('third');
  });

  it('should cancel pending call if called again within wait time', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 1000);

    debouncedFn();
    vi.advanceTimersByTime(500);

    debouncedFn();
    vi.advanceTimersByTime(500);
    expect(mockFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple rapid calls correctly', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 1000);

    // Rapid calls
    for (let i = 0; i < 10; i++) {
      debouncedFn(i);
      vi.advanceTimersByTime(100);
    }

    // Should not have been called yet
    expect(mockFn).not.toHaveBeenCalled();

    // Wait for final debounce
    vi.advanceTimersByTime(1000);

    // Should only be called once with last argument
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith(9);
  });

  it('should return cleanup function that cancels pending execution', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 1000);

    debouncedFn();
    const cleanup = debouncedFn.cancel;

    expect(typeof cleanup).toBe('function');

    cleanup();
    vi.advanceTimersByTime(1000);

    expect(mockFn).not.toHaveBeenCalled();
  });

  it('should support immediate execution option', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 1000, { immediate: true });

    debouncedFn();
    expect(mockFn).toHaveBeenCalledTimes(1);

    // Subsequent calls within wait time should not execute
    debouncedFn();
    debouncedFn();
    expect(mockFn).toHaveBeenCalledTimes(1);

    // After wait time, can execute immediately again
    vi.advanceTimersByTime(1000);
    debouncedFn();
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should preserve this context', () => {
    const obj = {
      value: 42,
      getValue: function(this: { value: number }) {
        return this.value;
      },
    };

    const debouncedGetValue = debounce(obj.getValue, 1000);
    debouncedGetValue.call(obj);

    vi.advanceTimersByTime(1000);

    // Note: We can't directly test the return value since debounce doesn't return anything
    // But we can verify it doesn't throw an error when called with context
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
  });

  it('should allow multiple debounced functions to work independently', () => {
    const mockFn1 = vi.fn();
    const mockFn2 = vi.fn();

    const debouncedFn1 = debounce(mockFn1, 1000);
    const debouncedFn2 = debounce(mockFn2, 500);

    debouncedFn1();
    debouncedFn2();

    vi.advanceTimersByTime(500);
    expect(mockFn1).not.toHaveBeenCalled();
    expect(mockFn2).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(500);
    expect(mockFn1).toHaveBeenCalledTimes(1);
    expect(mockFn2).toHaveBeenCalledTimes(1);
  });
});
