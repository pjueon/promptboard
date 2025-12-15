export interface DebounceOptions {
  immediate?: boolean;
}

export interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel: () => void;
}

/**
 * Creates a debounced function that delays invoking `func` until after `wait` milliseconds
 * have elapsed since the last time the debounced function was invoked.
 *
 * @param func - The function to debounce
 * @param wait - The number of milliseconds to delay
 * @param options - Options object
 * @param options.immediate - If true, trigger the function on the leading edge instead of trailing
 * @returns A debounced version of the function with a cancel method
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: DebounceOptions = {}
): DebouncedFunction<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastCallTime = 0;

  const cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const debounced = function(this: any, ...args: Parameters<T>): void {
    const now = Date.now();

    cancel();

    if (options.immediate) {
      // Immediate mode: execute on leading edge
      const callNow = timeoutId === null && (now - lastCallTime >= wait);

      timeoutId = setTimeout(() => {
        timeoutId = null;
      }, wait);

      if (callNow) {
        lastCallTime = now;
        Reflect.apply(func, this, args);
      }
    } else {
      // Default mode: execute on trailing edge
      const executeFunc = () => {
        timeoutId = null;
        Reflect.apply(func, this, args);
      };

      timeoutId = setTimeout(executeFunc, wait);
    }
  } as DebouncedFunction<T>;

  debounced.cancel = cancel;

  return debounced;
}
