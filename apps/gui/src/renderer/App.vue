<template>
  <div class="app">
    <AppTitlebar />
    <AppToolbar
      @clear-all="handleClearAll"
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
import { ref } from 'vue';
import AppTitlebar from './components/AppTitlebar.vue';
import AppToolbar from './components/AppToolbar.vue';
import WhiteboardCanvas from './components/WhiteboardCanvas.vue';
import AppSidebar from './components/AppSidebar.vue';
import ToastContainer from './components/ToastContainer.vue';

const canvasRef = ref<InstanceType<typeof WhiteboardCanvas> | null>(null);
const isSidebarOpen = ref(false);

function handleClearAll() {
  canvasRef.value?.clearCanvas();
}

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value;
}

function closeSidebar() {
  isSidebarOpen.value = false;
}
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
