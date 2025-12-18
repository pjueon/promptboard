<template>
  <div class="whiteboard-canvas-wrapper">
    <canvas ref="canvasRef"></canvas>
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';
import { useWhiteboard } from '../composables/useWhiteboard';
import type { ToolType } from '@promptboard/core-whiteboard';

interface Props {
  width?: number;
  height?: number;
  backgroundColor?: string;
}

const props = withDefaults(defineProps<Props>(), {
  width: 800,
  height: 600,
  backgroundColor: '#ffffff',
});

const emit = defineEmits<{
  ready: [];
  toolChange: [tool: ToolType];
  historyChange: [];
}>();

const {
  canvasRef,
  isReady,
  currentTool,
  canUndo,
  canRedo,
  initialize,
  cleanup,
  setTool,
  setToolOptions,
  getToolOptions,
  undo,
  redo,
  saveState,
  loadState,
  clear,
  getCanvas,
  resize,
  onToolChange,
  onHistoryChange,
  getManagers,
} = useWhiteboard();

// Initialize on mount
onMounted(async () => {
  try {
    await initialize({
      width: props.width,
      height: props.height,
      backgroundColor: props.backgroundColor,
    });

    emit('ready');
  } catch (error) {
    console.error('Failed to initialize whiteboard:', error);
  }
});

// Cleanup on unmount
onUnmounted(() => {
  cleanup();
});

// Watch for dimension changes
watch(
  () => [props.width, props.height],
  ([newWidth, newHeight]) => {
    if (isReady.value) {
      resize(newWidth as number, newHeight as number);
    }
  }
);

// Setup event forwarding
onToolChange((tool) => {
  emit('toolChange', tool);
});

onHistoryChange(() => {
  emit('historyChange');
});

// Expose methods and state
defineExpose({
  // State
  isReady,
  currentTool,
  canUndo,
  canRedo,

  // Tool management
  setTool,
  setToolOptions,
  getToolOptions,

  // History management
  undo,
  redo,

  // State management
  saveState,
  loadState,
  clear,
  clearCanvas: clear, // Alias for backward compatibility

  // Canvas access
  getCanvas,
  resize,
  getManagers,
});
</script>

<style scoped>
.whiteboard-canvas-wrapper {
  position: relative;
  display: inline-block;
}

canvas {
  border: 1px solid #ddd;
  cursor: crosshair;
}
</style>
