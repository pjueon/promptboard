import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import i18n from './i18n'
import './style.css'
import { useToolbarStore } from './stores/toolbarStore'
import { useHistoryStore } from './stores/historyStore'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(i18n)
app.mount('#app')

// Expose stores globally for E2E testing
const toolbarStore = useToolbarStore();
const historyStore = useHistoryStore();
(window as { 
  toolbarStore?: typeof toolbarStore;
  historyStore?: typeof historyStore;
}).toolbarStore = toolbarStore;
(window as { 
  toolbarStore?: typeof toolbarStore;
  historyStore?: typeof historyStore;
}).historyStore = historyStore;
