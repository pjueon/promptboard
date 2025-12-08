<template>
  <div class="toolbar">
    <!-- Tool Buttons -->
    <div class="tool-group">
      <button 
        v-for="tool in tools" 
        :key="tool.id"
        :class="['tool-btn', { active: currentTool === tool.id }]"
        :title="tool.label()"
        :data-testid="`tool-btn-${tool.id}`"
        @click="handleToolChange(tool.id)"
      >
        <component
          :is="tool.icon"
          :size="20"
          :stroke-width="2"
        />
      </button>
    </div>

    <!-- Color Picker -->
    <div class="tool-group">
      <label class="tool-label">{{ t('toolbar.color') }}:</label>
      <input 
        type="color" 
        :value="color" 
        class="color-picker"
        data-testid="color-picker"
        @input="handleColorChange"
      >
    </div>

    <!-- Stroke Width Slider (hidden when text tool is active) -->
    <div
      v-if="currentTool !== 'text'"
      class="tool-group"
    >
      <label class="tool-label">{{ t('toolbar.width') }}: {{ strokeWidth }}px</label>
      <input
        type="range"
        min="1"
        max="20"
        :value="strokeWidth"
        class="stroke-slider"
        data-testid="stroke-slider"
        @input="handleStrokeWidthChange"
      >
    </div>

    <!-- Font Size Slider (only visible when text tool is active) -->
    <div
      v-if="currentTool === 'text'"
      class="tool-group"
    >
      <label class="tool-label">{{ t('toolbar.font') }}: {{ fontSize }}px</label>
      <input 
        type="range" 
        min="12" 
        max="72" 
        :value="fontSize" 
        class="font-slider"
        data-testid="font-slider"
        @input="handleFontSizeChange"
      >
    </div>

    <!-- Action Buttons -->
    <div class="tool-group ml-auto">
      <button
        class="tool-btn save-btn"
        :title="t('toolbar.save')"
        data-testid="save-btn"
        @click="handleSaveClick"
      >
        <Save
          :size="20"
          :stroke-width="2"
        />
      </button>

      <button
        class="tool-btn clear-btn"
        :title="t('toolbar.clear')"
        data-testid="clear-btn"
        @click="handleClearClick"
      >
        <Trash2
          :size="20"
          :stroke-width="2"
        />
      </button>

      <button
        class="tool-btn"
        :title="t('toolbar.settings')"
        data-testid="settings-btn"
        @click="handleSidebarToggle"
      >
        <Settings
          :size="20"
          :stroke-width="2"
        />
      </button>
    </div>

    <!-- Confirm Modal -->
    <ConfirmModal
      :is-open="showClearModal"
      :title="t('modal.clearAll.title')"
      :message="t('modal.clearAll.message')"
      @confirm="handleClearConfirm"
      @cancel="handleClearCancel"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useToolbarStore, type Tool } from '../stores/toolbarStore';
import { useI18n } from 'vue-i18n';
import ConfirmModal from './ConfirmModal.vue';
import {
  Pencil,
  MousePointer2,
  Eraser,
  Minus,
  ArrowRight,
  Square,
  Circle,
  Type,
  Save,
  Trash2,
  Settings
} from 'lucide-vue-next';

const toolbarStore = useToolbarStore();
const { t } = useI18n();

// Computed properties from store
const currentTool = computed(() => toolbarStore.currentTool);
const color = computed(() => toolbarStore.color);
const strokeWidth = computed(() => toolbarStore.strokeWidth);
const fontSize = computed(() => toolbarStore.fontSize);

// Modal state
const showClearModal = ref(false);

// Define emit for events
const emit = defineEmits<{
  clearAll: [];
  saveCanvas: [];
  toggleSidebar: [];
}>();

// Tool definitions
const tools = [
  { id: 'pen' as Tool, label: () => t('toolbar.tools.pen'), icon: Pencil },
  { id: 'select' as Tool, label: () => t('toolbar.tools.select'), icon: MousePointer2 },
  { id: 'eraser' as Tool, label: () => t('toolbar.tools.eraser'), icon: Eraser },
  { id: 'line' as Tool, label: () => t('toolbar.tools.line'), icon: Minus },
  { id: 'arrow' as Tool, label: () => t('toolbar.tools.arrow'), icon: ArrowRight },
  { id: 'rectangle' as Tool, label: () => t('toolbar.tools.rectangle'), icon: Square },
  { id: 'ellipse' as Tool, label: () => t('toolbar.tools.ellipse'), icon: Circle },
  { id: 'text' as Tool, label: () => t('toolbar.tools.text'), icon: Type },
];

// Event handlers
function handleToolChange(tool: Tool) {
  toolbarStore.setTool(tool);
}

function handleColorChange(e: Event) {
  const target = e.target as HTMLInputElement;
  toolbarStore.setColor(target.value);
}

function handleStrokeWidthChange(e: Event) {
  const target = e.target as HTMLInputElement;
  toolbarStore.setStrokeWidth(Number(target.value));
}

function handleFontSizeChange(e: Event) {
  const target = e.target as HTMLInputElement;
  toolbarStore.setFontSize(Number(target.value));
}

function handleSaveClick() {
  emit('saveCanvas');
}

function handleClearClick() {
  showClearModal.value = true;
}

function handleClearConfirm() {
  showClearModal.value = false;
  emit('clearAll');
}

function handleClearCancel() {
  showClearModal.value = false;
}

function handleSidebarToggle() {
  emit('toggleSidebar');
}
</script>

<style scoped>
.toolbar {
  position: fixed;
  top: 32px;
  left: 0;
  right: 0;
  background-color: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
  z-index: 1000;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ml-auto {
  margin-left: auto;
}

.tool-btn {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-primary);
  cursor: pointer;
  transition: all 0.15s;
  color: var(--color-text-secondary);
}

.save-btn {
  background-color: #f0f9ff;
  border-color: #93c5fd;
  color: #2563eb;
}

.save-btn:hover {
  background-color: #dbeafe;
  border-color: #60a5fa;
}

.clear-btn {
  background-color: #fef2f2;
  border-color: #fca5a5;
  color: #dc2626;
}

.clear-btn:hover {
  background-color: #fee2e2;
  border-color: #f87171;
}

.tool-btn:hover {
  background-color: var(--color-bg-tertiary);
}

.tool-btn:active {
  background-color: var(--color-bg-secondary);
}

.tool-btn.active {
  background-color: var(--color-accent-lighter);
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.tool-icon {
  pointer-events: none;
}

.tool-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.color-picker {
  width: 3rem;
  height: 2.5rem;
  border-radius: 0.25rem;
  border: 1px solid var(--color-border);
  cursor: pointer;
}

.stroke-slider {
  width: 8rem;
}
</style>
