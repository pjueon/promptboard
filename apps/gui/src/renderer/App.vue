<template>
  <div class="app">
    <Titlebar />
    <Toolbar @clearAll="handleClearAll" @toggleSidebar="toggleSidebar" />
    <WhiteboardCanvas ref="canvasRef" />
    <Sidebar :isOpen="isSidebarOpen" @close="closeSidebar" />
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Titlebar from './components/Titlebar.vue';
import Toolbar from './components/Toolbar.vue';
import WhiteboardCanvas from './components/WhiteboardCanvas.vue';
import Sidebar from './components/Sidebar.vue';
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
