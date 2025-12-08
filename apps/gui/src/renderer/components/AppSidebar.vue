<template>
  <div 
    :class="['sidebar', { closed: !isOpen }]"
    tabindex="0"
    @keydown.esc="handleClose"
  >
    <div
      v-if="isOpen"
      class="sidebar-content"
    >
      <div class="sidebar-header">
        <div class="tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="['tab', { active: activeTab === tab.id }]"
            @click="activeTab = tab.id"
          >
            <component
              :is="tab.icon"
              :size="16"
              :stroke-width="2"
            />
            <span>{{ tab.label() }}</span>
          </button>
        </div>
        <button
          class="close-button"
          @click="handleClose"
        >
          <X
            :size="20"
            :stroke-width="2"
          />
        </button>
      </div>

      <div class="tab-content">
        <div
          v-if="activeTab === 'settings'"
          class="settings-content"
        >
          <h3>{{ t('sidebar.settings.theme') }}</h3>
          
          <div class="setting-group">
            <label class="setting-label">{{ t('sidebar.settings.appearance') }}</label>
            <div class="theme-selector">
              <button
                :class="['theme-option', { active: !themeStore.isDark }]"
                @click="themeStore.setTheme('light')"
              >
                <Sun
                  :size="20"
                  :stroke-width="2"
                />
                <span>{{ t('sidebar.settings.light') }}</span>
              </button>
              <button
                :class="['theme-option', { active: themeStore.isDark }]"
                @click="themeStore.setTheme('dark')"
              >
                <Moon
                  :size="20"
                  :stroke-width="2"
                />
                <span>{{ t('sidebar.settings.dark') }}</span>
              </button>
            </div>
          </div>

          <div class="setting-group">
            <label class="setting-label">{{ t('sidebar.settings.language') }}</label>
            <select
              class="language-select"
              :value="localeStore.locale"
              @change="(e) => localeStore.setLocale((e.target as HTMLSelectElement).value as any)"
            >
              <option
                v-for="lang in languages"
                :key="lang.code"
                :value="lang.code"
              >
                {{ lang.name }}
              </option>
            </select>
          </div>

          <h3>{{ t('sidebar.settings.autoSave') }}</h3>

          <div class="setting-group">
            <label class="checkbox-label">
              <input
                type="checkbox"
                :checked="autoSaveStore.autoSave"
                @change="(e) => autoSaveStore.setAutoSave((e.target as HTMLInputElement).checked)"
              >
              <span>{{ t('sidebar.settings.autoSaveEnabled') }}</span>
            </label>
          </div>

          <div
            v-if="autoSaveStore.autoSave"
            class="setting-group"
          >
            <label class="setting-label">{{ t('sidebar.settings.autoSaveDebounce') }}</label>
            <input
              type="number"
              class="interval-input"
              :value="autoSaveStore.autoSaveDebounceMs"
              min="100"
              step="100"
              @change="(e) => autoSaveStore.setAutoSaveDebounce(Number((e.target as HTMLInputElement).value))"
            >
            <span class="unit-label">ms</span>
          </div>

          <div
            v-if="autoSaveStore.lastSaved"
            class="setting-group"
          >
            <label class="setting-label">{{ t('sidebar.settings.lastSaved') }}</label>
            <div class="last-saved-time">
              {{ formatLastSaved(autoSaveStore.lastSaved) }}
            </div>
          </div>
          <div
            v-else
            class="setting-group"
          >
            <label class="setting-label">{{ t('sidebar.settings.lastSaved') }}</label>
            <div class="last-saved-time">
              {{ t('sidebar.settings.never') }}
            </div>
          </div>
        </div>

        <div
          v-if="activeTab === 'info'"
          class="info-content"
        >
          <h3>{{ t('sidebar.info.shortcuts') }}</h3>
          
          <div class="shortcut-category">
            <h4>{{ t('sidebar.info.editing') }}</h4>
            <div class="shortcut-list">
              <div class="shortcut-item">
                <span class="shortcut-desc">{{ t('sidebar.shortcuts.undo') }}</span>
                <kbd class="shortcut-key">Ctrl+Z</kbd>
              </div>
              <div class="shortcut-item">
                <span class="shortcut-desc">{{ t('sidebar.shortcuts.redo') }}</span>
                <div class="shortcut-keys">
                  <kbd class="shortcut-key">Ctrl+Shift+Z</kbd>
                  <span class="or">{{ t('sidebar.shortcuts.or') }}</span>
                  <kbd class="shortcut-key">Ctrl+Y</kbd>
                </div>
              </div>
              <div class="shortcut-item">
                <span class="shortcut-desc">{{ t('sidebar.shortcuts.save') }}</span>
                <kbd class="shortcut-key">Ctrl+S</kbd>
              </div>
              <div class="shortcut-item">
                <span class="shortcut-desc">{{ t('sidebar.shortcuts.increaseStroke') }}</span>
                <kbd class="shortcut-key">]</kbd>
              </div>
              <div class="shortcut-item">
                <span class="shortcut-desc">{{ t('sidebar.shortcuts.decreaseStroke') }}</span>
                <kbd class="shortcut-key">[</kbd>
              </div>
            </div>
          </div>

          <div class="shortcut-category">
            <h4>{{ t('sidebar.info.selectionClipboard') }}</h4>
            <div class="shortcut-list">
              <div class="shortcut-item">
                <span class="shortcut-desc">{{ t('sidebar.shortcuts.copy') }}</span>
                <kbd class="shortcut-key">Ctrl+C</kbd>
              </div>
              <div class="shortcut-item">
                <span class="shortcut-desc">{{ t('sidebar.shortcuts.paste') }}</span>
                <kbd class="shortcut-key">Ctrl+V</kbd>
              </div>
              <div class="shortcut-item">
                <span class="shortcut-desc">{{ t('sidebar.shortcuts.delete') }}</span>
                <kbd class="shortcut-key">Delete</kbd>
              </div>
              <div class="shortcut-item">
                <span class="shortcut-desc">{{ t('sidebar.shortcuts.cancel') }}</span>
                <kbd class="shortcut-key">ESC</kbd>
              </div>
            </div>
          </div>

          <div class="app-info">
            <h3>{{ t('sidebar.info.about') }}</h3>
            <p><strong>{{ t('sidebar.info.version') }}:</strong> {{ appVersion }}</p>
            <p><strong>PromptBoard</strong> - {{ t('sidebar.info.description') }}</p>
            <p>{{ t('sidebar.info.subtitle') }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Settings, Info, X, Sun, Moon } from 'lucide-vue-next';
import { useThemeStore } from '../stores/themeStore';
import { useLocaleStore } from '../stores/localeStore';
import { useAutoSaveStore } from '../stores/autoSaveStore';
import { useI18n } from 'vue-i18n';

declare const __APP_VERSION__: string;
const appVersion = __APP_VERSION__;

const emit = defineEmits<{
  close: [];
}>();

defineProps<{
  isOpen?: boolean;
}>();

const activeTab = ref<'settings' | 'info'>('settings');
const themeStore = useThemeStore();
const localeStore = useLocaleStore();
const autoSaveStore = useAutoSaveStore();
const { t } = useI18n();

const tabs = [
  { id: 'settings' as const, label: () => t('sidebar.tabs.settings'), icon: Settings },
  { id: 'info' as const, label: () => t('sidebar.tabs.info'), icon: Info }
];

const languages = [
  { code: 'en' as const, name: 'English' },
  { code: 'ko' as const, name: '한국어' },
  { code: 'ja' as const, name: '日本語' },
];

function formatLastSaved(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) {
    return `${diff}s ago`;
  } else if (diff < 3600) {
    return `${Math.floor(diff / 60)}m ago`;
  } else if (diff < 86400) {
    return `${Math.floor(diff / 3600)}h ago`;
  } else {
    return date.toLocaleString();
  }
}

function handleClose() {
  emit('close');
}
</script>

<style scoped>
.sidebar {
  position: fixed;
  top: 32px;
  right: 0;
  height: calc(100vh - 32px);
  width: 320px;
  background: var(--color-bg-primary);
  border-left: 1px solid var(--color-border);
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, background-color 0.2s ease;
  z-index: 1000;
}

.sidebar.closed {
  transform: translateX(100%);
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}

.tabs {
  display: flex;
  gap: 8px;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
  font-size: 14px;
  color: var(--color-text-tertiary);
}

.tab:hover {
  background: var(--color-bg-tertiary);
}

.tab.active {
  background: var(--color-accent-light);
  color: var(--color-accent);
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
  color: var(--color-text-tertiary);
}

.close-button:hover {
  background: var(--color-bg-tertiary);
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.settings-content h3,
.info-content h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.settings-content h4,
.info-content h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.settings-content p,
.info-content p {
  margin: 0;
  color: var(--color-text-tertiary);
  font-size: 14px;
}

.shortcut-category {
  margin-bottom: 24px;
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--color-bg-secondary);
  border-radius: 6px;
}

.shortcut-desc {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.shortcut-key {
  padding: 4px 8px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 12px;
  font-family: monospace;
  color: var(--color-text-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.shortcut-keys {
  display: flex;
  align-items: center;
  gap: 6px;
}

.shortcut-keys .or {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.app-info {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--color-border);
}

.app-info p {
  margin-bottom: 8px;
}

.setting-group {
  margin-bottom: 24px;
}

.setting-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: 12px;
}

.theme-selector {
  display: flex;
  gap: 12px;
}

.theme-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  border: 2px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-primary);
  cursor: pointer;
  transition: all 0.2s;
  color: var(--color-text-tertiary);
}

.theme-option:hover {
  border-color: var(--color-border-dark);
  background: var(--color-bg-secondary);
}

.theme-option.active {
  border-color: var(--color-accent);
  background: var(--color-accent-lighter);
  color: var(--color-accent);
}

.theme-option span {
  font-size: 14px;
  font-weight: 500;
}

.language-select {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  outline: none;
}

.language-select:hover {
  border-color: var(--color-border-dark);
}

.language-select:focus {
  border-color: var(--color-accent);
}

.language-select option {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  padding: 8px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text-primary);
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--color-accent);
}

.interval-input {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 500;
  outline: none;
  transition: all 0.2s;
}

.interval-input:hover {
  border-color: var(--color-border-dark);
}

.interval-input:focus {
  border-color: var(--color-accent);
}

.last-saved-time {
  font-size: 13px;
  color: var(--color-text-tertiary);
  padding: 8px 12px;
  background: var(--color-bg-secondary);
  border-radius: 6px;
}
</style>
