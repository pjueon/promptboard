import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { CanvasState } from '../types/canvas';

export const useHistoryStore = defineStore('history', () => {
  // State
  const snapshots = ref<CanvasState[]>([]);
  const currentIndex = ref(-1);
  const maxHistory = ref(50);

  // Computed
  const canUndo = computed(() => currentIndex.value > 0);
  const canRedo = computed(() => currentIndex.value < snapshots.value.length - 1);

  // Actions
  function saveSnapshot(canvasState: CanvasState) {
    // Remove all snapshots after current index (branch prevention)
    snapshots.value = snapshots.value.slice(0, currentIndex.value + 1);

    // Add new snapshot
    snapshots.value.push(canvasState);
    currentIndex.value++;

    // Trim old snapshots if exceeding max
    if (snapshots.value.length > maxHistory.value) {
      snapshots.value.shift();
      currentIndex.value--;
    }
  }

  function undo(): CanvasState | null {
    if (currentIndex.value > 0) {
      currentIndex.value--;
      return snapshots.value[currentIndex.value];
    }
    return null;
  }

  function redo(): CanvasState | null {
    if (currentIndex.value < snapshots.value.length - 1) {
      currentIndex.value++;
      return snapshots.value[currentIndex.value];
    }
    return null;
  }

  function clearHistory() {
    snapshots.value = [];
    currentIndex.value = -1;
  }

  return {
    snapshots,
    currentIndex,
    maxHistory,
    canUndo,
    canRedo,
    saveSnapshot,
    undo,
    redo,
    clearHistory,
  };
});
