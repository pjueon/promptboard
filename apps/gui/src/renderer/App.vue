<template>
  <div class="app">
    <AppTitlebar />
    <AppToolbar
      @clear-all="handleClearAll"
      @save-canvas="handleSaveCanvas"
      @toggle-sidebar="toggleSidebar"
    />
    <div
      ref="canvasContainerRef"
      class="canvas-container"
    >
      <WhiteboardCanvas
        ref="canvasRef"
        :width="canvasWidth"
        :height="canvasHeight"
        :auto-save-enabled="autoSaveStore.isEnabled"
        :auto-save-debounce-ms="autoSaveStore.debounceMs"
        @ready="onCanvasReady"
        @history-change="onHistoryChange"
        @tool-change="onToolChange"
        @tool-options-change="onToolOptionsChange"
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
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
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
import { debounce, type DebouncedFunction } from './utils/debounce';

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
let debouncedAutoSave: DebouncedFunction<() => Promise<void>> | null = null;
let isLoadingState = false; // Flag to prevent auto-save during initial load

function handleClearAll() {
  canvasRef.value?.clearCanvas();
}

/**
 * Setup auto-save functionality
 */
function setupAutoSave() {
  if (!autoSaveStore.isEnabled) {
    return;
  }

  // Create debounced save function
  debouncedAutoSave = debounce(async () => {
    if (autoSaveStore.isEnabled && canvasRef.value) {
      const state = await canvasRef.value.saveState();
      const canvasData = JSON.parse(state);
      await autoSaveStore.saveWhiteboardState(canvasData);
    }
  }, autoSaveStore.debounceMs);
}

/**
 * Handle history change event (triggered by canvas changes)
 */
function onHistoryChange() {
  // Update undo/redo state for E2E tests
  if (canvasRef.value && (window as any).undoRedoState) {
    const state = (window as any).undoRedoState;
    state.canUndo.value = canvasRef.value.canUndo.value;
    state.canRedo.value = canvasRef.value.canRedo.value;
  }

  // Don't trigger auto-save during initial load
  if (isLoadingState) {
    return;
  }

  if (autoSaveStore.isEnabled && debouncedAutoSave) {
    debouncedAutoSave();
  }
}

/**
 * Load canvas state from auto-save
 */
async function loadCanvasState() {
  const state = await autoSaveStore.loadWhiteboardState();
  if (state && state.canvasData) {
    // Check if data is double-nested (backward compatibility)
    if (state.canvasData.canvasData) {
      const stateString = JSON.stringify(state.canvasData.canvasData);
      await canvasRef.value?.loadState(stateString);
    } else {
      const stateString = JSON.stringify(state.canvasData);
      await canvasRef.value?.loadState(stateString);
    }
  }
}

async function onCanvasReady() {
  if (canvasRef.value) {
    // Set loading flag to prevent auto-save during initialization
    isLoadingState = true;

    // Set initial tool and options
    canvasRef.value.setTool(toolbarStore.currentTool as ToolType);
    canvasRef.value.setToolOptions({
      color: toolbarStore.color,
      strokeWidth: toolbarStore.strokeWidth,
      fontSize: toolbarStore.fontSize,
    });

    const managers = canvasRef.value.getManagers();

    // Save initial empty canvas snapshot first
    // This ensures we can undo back to a blank canvas
    if (managers && managers.historyManager) {
      managers.historyManager.saveSnapshot();
    }

    // Load saved state (if exists)
    await loadCanvasState();

    // Save snapshot after loading auto-save state (if any was loaded)
    // This creates a second snapshot with the loaded state
    if (managers && managers.historyManager) {
      managers.historyManager.saveSnapshot();
    }

    // Setup auto-save
    setupAutoSave();

    // Clear loading flag - now auto-save can work
    isLoadingState = false;

    // Set initial cursor
    updateCanvasCursor(toolbarStore.currentTool);

    // Expose internals for E2E testing
    if (managers) {
      (window as Record<string, unknown>).fabricCanvas = managers.canvasManager?.getCanvas();
      (window as Record<string, unknown>).historyManager = managers.historyManager;
    }

    (window as Record<string, unknown>).isCanvasLoading = { value: false };
    (window as Record<string, unknown>).toolbarStore = toolbarStore;

    // Initialize undo/redo state object (compatible with test expectations)
    (window as any).undoRedoState = {
      canUndo: { value: false },
      canRedo: { value: false }
    };

    // Wait for next tick to ensure all events have been processed
    await nextTick();

    // Manually trigger initial undoRedoState update
    if (canvasRef.value) {
      const state = (window as any).undoRedoState;
      state.canUndo.value = canvasRef.value.canUndo.value;
      state.canRedo.value = canvasRef.value.canRedo.value;
    }
  }
}

/**
 * Handle tool change event from canvas
 */
function onToolChange(tool: ToolType) {
  toolbarStore.setTool(tool);
  updateCanvasCursor(tool);
}

/**
 * Handle tool options change event from canvas (e.g., from keyboard shortcuts)
 */
function onToolOptionsChange(options: { color?: string; strokeWidth?: number; fontSize?: number }) {
  if (options.color !== undefined) {
    toolbarStore.setColor(options.color);
  }
  if (options.strokeWidth !== undefined) {
    toolbarStore.setStrokeWidth(options.strokeWidth);
  }
  if (options.fontSize !== undefined) {
    toolbarStore.setFontSize(options.fontSize);
  }
}

/**
 * Update canvas cursor based on current tool
 */
function updateCanvasCursor(tool: string) {
  const canvas = canvasRef.value?.getCanvas();
  if (!canvas) return;

  let cursor = 'default';

  switch (tool) {
    case 'pen':
      cursor = 'crosshair';
      break;
    case 'line':
    case 'arrow':
    case 'rectangle':
    case 'ellipse':
      cursor = 'crosshair';
      break;
    case 'text':
      cursor = 'text';
      break;
    case 'eraser':
      // Eraser cursor is managed by EraserTool
      return;
    case 'select': {
      cursor = 'default';
      canvas.defaultCursor = cursor;
      canvas.hoverCursor = 'move';

      // Immediately update the actual DOM cursor style
      const upperCanvasEl = (canvas as Record<string, HTMLCanvasElement>).upperCanvasEl;
      if (upperCanvasEl) {
        upperCanvasEl.style.cursor = cursor;
      }
      return;
    }
    default:
      cursor = 'default';
      break;
  }

  canvas.defaultCursor = cursor;
  canvas.hoverCursor = cursor;

  // For drawing mode (pen and eraser), also set freeDrawingCursor
  if (canvas.isDrawingMode) {
    canvas.freeDrawingCursor = cursor;
  }

  // Immediately update the actual DOM cursor style
  const upperCanvasEl = (canvas as Record<string, HTMLCanvasElement>).upperCanvasEl;
  if (upperCanvasEl) {
    upperCanvasEl.style.cursor = cursor;
  }

  canvas.renderAll();
}

// Watch for tool changes
watch(
  () => toolbarStore.currentTool,
  (newTool) => {
    canvasRef.value?.setTool(newTool as ToolType);
    updateCanvasCursor(newTool);
  }
);

// Watch for property changes
watch(
  () => [toolbarStore.color, toolbarStore.strokeWidth, toolbarStore.fontSize],
  ([newColor, newWidth, newFontSize]) => {
    canvasRef.value?.setToolOptions({
      color: newColor as string,
      strokeWidth: newWidth as number,
      fontSize: newFontSize as number,
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
  if (debouncedAutoSave) {
    debouncedAutoSave.cancel();
    debouncedAutoSave = null;
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
  background-color: #ffffff; /* White background to match canvas */
}
</style>
