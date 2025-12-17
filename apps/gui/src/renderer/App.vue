<template>
  <div class="app">
    <AppTitlebar />
    <AppToolbar
      @clear-all="handleClearAll"
      @save-canvas="handleSaveCanvas"
      @toggle-sidebar="toggleSidebar"
    />
    <div class="canvas-container" ref="canvasContainerRef">
      <WhiteboardCanvas
        ref="canvasRef"
        :width="canvasWidth"
        :height="canvasHeight"
        :auto-save-enabled="autoSaveStore.isEnabled"
        :auto-save-debounce-ms="autoSaveStore.debounceMs"
        @ready="onCanvasReady"
      />
    </div>
    <AppSidebar
      :is-open="isSidebarOpen"
      @close="closeSidebar"
    />
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import AppTitlebar from './components/AppTitlebar.vue';
import AppToolbar from './components/AppToolbar.vue';
import { WhiteboardCanvas } from '@promptboard/vue-whiteboard';
import AppSidebar from './components/AppSidebar.vue';
import ToastContainer from './components/ToastContainer.vue';
import { useToastStore } from './stores/toastStore';
import { useAutoSaveStore } from './stores/autoSaveStore';
import { useToolbarStore } from './stores/toolbarStore';
import type { ToolType } from '@promptboard/core-whiteboard';

const { t } = useI18n();
const toastStore = useToastStore();
const autoSaveStore = useAutoSaveStore();
const toolbarStore = useToolbarStore();
const canvasRef = ref<InstanceType<typeof WhiteboardCanvas> | null>(null);
const canvasContainerRef = ref<HTMLElement | null>(null);
const isSidebarOpen = ref(false);

const canvasWidth = ref(800);
const canvasHeight = ref(600);
let resizeObserver: ResizeObserver | null = null;

function handleClearAll() {
  canvasRef.value?.clearCanvas();
}

function onCanvasReady() {
  if (canvasRef.value) {
    // Set initial tool and options
    canvasRef.value.setTool(toolbarStore.currentTool as ToolType);
    canvasRef.value.setToolOptions({
      color: toolbarStore.color,
      strokeWidth: toolbarStore.strokeWidth,
    });

    // Expose internals for E2E testing
    const managers = canvasRef.value.getManagers();
    if (managers) {
      (window as any).fabricCanvas = managers.canvasManager?.getCanvas();
      (window as any).historyManager = managers.historyManager;
    }
    
    (window as any).undoRedoState = {
      canUndo: canvasRef.value.canUndo,
      canRedo: canvasRef.value.canRedo
    };

    (window as any).isCanvasLoading = { value: false };
  }
}

// Watch for tool changes
watch(
  () => toolbarStore.currentTool,
  (newTool) => {
    canvasRef.value?.setTool(newTool as ToolType);
  }
);

// Watch for property changes
watch(
  () => [toolbarStore.color, toolbarStore.strokeWidth],
  ([newColor, newWidth]) => {
    canvasRef.value?.setToolOptions({
      color: newColor as string,
      strokeWidth: newWidth as number,
    });
  }
);

async function handleSaveCanvas() {
  try {
    // First, show save dialog to get file path and format
    const dialogResult = await window.electronAPI.whiteboard.saveAsFile();

    if (dialogResult.canceled) {
      toastStore.info(t('toast.saveCanceled'));
      return;
    }

    if (!dialogResult.success || !dialogResult.filePath || !dialogResult.format) {
      toastStore.error(t('toast.saveError'));
      return;
    }

    // Get canvas image in the selected format
    const base64Image = canvasRef.value?.getCanvasImage(dialogResult.format);

    if (!base64Image) {
      toastStore.error(t('toast.saveError'));
      return;
    }

    // Write file via IPC
    const writeResult = await window.electronAPI.whiteboard.writeImageFile(dialogResult.filePath, base64Image);

    if (writeResult.success) {
      toastStore.success(t('toast.saveSuccess'));
    } else {
      toastStore.error(t('toast.saveError'));
    }
  } catch (error) {
    console.error('Failed to save canvas:', error);
    toastStore.error(t('toast.saveError'));
  }
}

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value;
}

function closeSidebar() {
  isSidebarOpen.value = false;
}

// Listen for Ctrl+S keyboard shortcut from canvas
function handleSaveShortcut() {
  handleSaveCanvas();
}

function updateCanvasSize() {
  if (canvasContainerRef.value) {
    const { width, height } = canvasContainerRef.value.getBoundingClientRect();
    // Only update if dimensions actually changed and are valid
    if (width > 0 && height > 0 && (width !== canvasWidth.value || height !== canvasHeight.value)) {
      canvasWidth.value = width;
      canvasHeight.value = height;
    }
  }
}

onMounted(() => {
  window.addEventListener('save-canvas-shortcut', handleSaveShortcut);
  
  // Setup ResizeObserver
  if (canvasContainerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      // Use requestAnimationFrame to avoid "ResizeObserver loop limit exceeded"
      requestAnimationFrame(() => {
        updateCanvasSize();
      });
    });
    resizeObserver.observe(canvasContainerRef.value);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('save-canvas-shortcut', handleSaveShortcut);
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});
</script>

<style scoped>
.app {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.canvas-container {
  flex: 1;
  width: 100%;
  position: relative;
  overflow: hidden;
  background-color: #f3f4f6; /* Light gray background for the container area */
}
</style>
