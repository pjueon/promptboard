import { describe, it, expect } from 'vitest';

/**
 * Sample Unit Test
 * Check if Vitest setup is working correctly
 */
describe('Sample Unit Test', () => {
  it('should pass basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle string operations', () => {
    const str = 'Hello World';
    expect(str).toContain('World');
    expect(str.toLowerCase()).toBe('hello world');
  });

  it('should work with arrays', () => {
    const arr = [1, 2, 3];
    expect(arr).toHaveLength(3);
    expect(arr).toContain(2);
  });
});
