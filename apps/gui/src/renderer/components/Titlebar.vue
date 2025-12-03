<template>
  <div class="titlebar">
    <div class="titlebar-drag-region" @dblclick="handleMaximize">
      <div class="titlebar-title">PromptBoard</div>
    </div>
    <div class="titlebar-controls">
      <button 
        class="titlebar-button minimize"
        @click="handleMinimize"
        title="Minimize"
      >
        <Minus :size="14" :stroke-width="2" />
      </button>
      <button 
        class="titlebar-button maximize"
        @click="handleMaximize"
        :title="isMaximized ? 'Restore' : 'Maximize'"
      >
        <component :is="isMaximized ? Copy : Square" :size="14" :stroke-width="2" :class="{ 'flip-h': isMaximized }" />
      </button>
      <button 
        class="titlebar-button close"
        @click="handleClose"
        title="Close"
      >
        <X :size="14" :stroke-width="2" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Minus, Square, Copy, X } from 'lucide-vue-next';

const isMaximized = ref(false);

async function handleMinimize() {
  if (window.electronAPI?.window) {
    await window.electronAPI.window.minimize();
  }
}

async function handleMaximize() {
  if (window.electronAPI?.window) {
    const maximized = await window.electronAPI.window.maximize();
    isMaximized.value = maximized;
  }
}

async function handleClose() {
  if (window.electronAPI?.window) {
    await window.electronAPI.window.close();
  }
  }
</script>

<style scoped>
.titlebar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 32px;
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 9999;
  user-select: none;
  -webkit-user-select: none;
  -webkit-app-region: no-drag;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.titlebar-drag-region {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  padding-left: 12px;
  -webkit-app-region: drag;
}

.titlebar-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.titlebar-controls {
  display: flex;
  height: 100%;
  -webkit-app-region: no-drag;
}

.titlebar-button {
  width: 46px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.titlebar-button:hover {
  background: var(--color-bg-tertiary);
}

.titlebar-button.close:hover {
  background: #e81123;
  color: white;
}

.titlebar-button:active {
  background: var(--color-bg-secondary);
}

.titlebar-button.close:active {
  background: #c50f1f;
}

.flip-h {
  transform: scaleX(-1);
}
</style>
