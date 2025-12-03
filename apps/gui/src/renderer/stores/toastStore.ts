import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([]);
  let nextId = 1;

  function showToast(message: string, type: ToastType = 'info', duration: number = 3000) {
    const id = nextId++;
    const toast: Toast = {
      id,
      message,
      type,
      duration,
    };

    toasts.value.push(toast);

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }

  function removeToast(id: number) {
    const index = toasts.value.findIndex(t => t.id === id);
    if (index !== -1) {
      toasts.value.splice(index, 1);
    }
  }

  function success(message: string, duration?: number) {
    return showToast(message, 'success', duration);
  }

  function error(message: string, duration?: number) {
    return showToast(message, 'error', duration);
  }

  function info(message: string, duration?: number) {
    return showToast(message, 'info', duration);
  }

  function warning(message: string, duration?: number) {
    return showToast(message, 'warning', duration);
  }

  function clear() {
    toasts.value = [];
  }

  return {
    toasts,
    showToast,
    removeToast,
    success,
    error,
    info,
    warning,
    clear,
  };
});
