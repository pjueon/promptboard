<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="['toast', `toast-${toast.type}`]"
        @click="removeToast(toast.id)"
      >
        <div class="toast-icon">
          <CheckCircle
            v-if="toast.type === 'success'"
            :size="20"
            :stroke-width="2"
          />
          <XCircle
            v-else-if="toast.type === 'error'"
            :size="20"
            :stroke-width="2"
          />
          <AlertCircle
            v-else-if="toast.type === 'warning'"
            :size="20"
            :stroke-width="2"
          />
          <Info
            v-else
            :size="20"
            :stroke-width="2"
          />
        </div>
        <div class="toast-message">
          {{ toast.message }}
        </div>
        <button
          class="toast-close"
          @click.stop="removeToast(toast.id)"
        >
          <X
            :size="16"
            :stroke-width="2"
          />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useToastStore } from '../stores/toastStore';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-vue-next';

const toastStore = useToastStore();
const toasts = computed(() => toastStore.toasts);

function removeToast(id: number) {
  toastStore.removeToast(id);
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 72px; /* Below toolbar */
  right: 1rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 300px;
  max-width: 500px;
  padding: 0.75rem 1rem;
  background-color: white;
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  pointer-events: auto;
  cursor: pointer;
  transition: all 0.2s;
}

.toast:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  transform: translateY(-2px);
}

.toast-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast-message {
  flex: 1;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.toast-close {
  flex-shrink: 0;
  padding: 0.25rem;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #6b7280;
  border-radius: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.toast-close:hover {
  background-color: #f3f4f6;
  color: #374151;
}

/* Toast type styles */
.toast-success {
  border-left: 4px solid #10b981;
}

.toast-success .toast-icon {
  color: #10b981;
}

.toast-error {
  border-left: 4px solid #ef4444;
}

.toast-error .toast-icon {
  color: #ef4444;
}

.toast-warning {
  border-left: 4px solid #f59e0b;
}

.toast-warning .toast-icon {
  color: #f59e0b;
}

.toast-info {
  border-left: 4px solid #3b82f6;
}

.toast-info .toast-icon {
  color: #3b82f6;
}

/* Transition animations */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.9);
}

.toast-move {
  transition: transform 0.3s ease;
}
</style>
