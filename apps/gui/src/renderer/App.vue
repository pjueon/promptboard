<template>
  <div class="app">
    <AppTitlebar />
    <AppToolbar
      @clear-all="handleClearAll"
      @save-canvas="handleSaveCanvas"
      @toggle-sidebar="toggleSidebar"
    />
    <WhiteboardCanvas ref="canvasRef" />
    <AppSidebar
      :is-open="isSidebarOpen"
      @close="closeSidebar"
    />
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import AppTitlebar from './components/AppTitlebar.vue';
import AppToolbar from './components/AppToolbar.vue';
import WhiteboardCanvas from './components/WhiteboardCanvas.vue';
import AppSidebar from './components/AppSidebar.vue';
import ToastContainer from './components/ToastContainer.vue';
import { useToastStore } from './stores/toastStore';

const { t } = useI18n();
const toastStore = useToastStore();
const canvasRef = ref<InstanceType<typeof WhiteboardCanvas> | null>(null);
const isSidebarOpen = ref(false);

function handleClearAll() {
  canvasRef.value?.clearCanvas();
}

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

onMounted(() => {
  window.addEventListener('save-canvas-shortcut', handleSaveShortcut);
});

onBeforeUnmount(() => {
  window.removeEventListener('save-canvas-shortcut', handleSaveShortcut);
});
</script>

<style scoped>
.app {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>
