import { describe, it, expect, beforeEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ToastContainer from '../../src/renderer/components/ToastContainer.vue';
import { useToastStore } from '../../src/renderer/stores/toastStore';

describe('ToastContainer', () => {
  let wrapper: VueWrapper;
  let toastStore: ReturnType<typeof useToastStore>;

  beforeEach(() => {
    // Create fresh pinia instance
    const pinia = createPinia();
    setActivePinia(pinia);
    toastStore = useToastStore();

    // Mount component
    wrapper = mount(ToastContainer, {
      global: {
        plugins: [pinia],
        stubs: {
          // Stub lucide icons to avoid jsdom issues
          CheckCircle: true,
          XCircle: true,
          AlertCircle: true,
          Info: true,
          X: true,
          TransitionGroup: true, // Stub to avoid animation delays
        },
      },
    });
  });

  describe('Rendering', () => {
    it('should render empty container initially', () => {
      expect(wrapper.find('.toast-container').exists()).toBe(true);
      expect(wrapper.findAll('.toast')).toHaveLength(0);
    });

    it('should render toast when added to store', async () => {
      toastStore.showToast('Test message', 'info', 0);
      await wrapper.vm.$nextTick();

      const toasts = wrapper.findAll('.toast');
      expect(toasts).toHaveLength(1);
    });

    it('should render multiple toasts', async () => {
      toastStore.showToast('First', 'info', 0);
      toastStore.showToast('Second', 'success', 0);
      toastStore.showToast('Third', 'error', 0);
      await wrapper.vm.$nextTick();

      const toasts = wrapper.findAll('.toast');
      expect(toasts).toHaveLength(3);
    });

    it('should display toast message', async () => {
      toastStore.showToast('Important notification', 'info', 0);
      await wrapper.vm.$nextTick();

      const message = wrapper.find('.toast-message');
      expect(message.text()).toBe('Important notification');
    });
  });

  describe('Toast Types', () => {
    it('should apply success class for success toast', async () => {
      toastStore.success('Success message', 0);
      await wrapper.vm.$nextTick();

      const toast = wrapper.find('.toast');
      expect(toast.classes()).toContain('toast-success');
    });

    it('should apply error class for error toast', async () => {
      toastStore.error('Error message', 0);
      await wrapper.vm.$nextTick();

      const toast = wrapper.find('.toast');
      expect(toast.classes()).toContain('toast-error');
    });

    it('should apply warning class for warning toast', async () => {
      toastStore.warning('Warning message', 0);
      await wrapper.vm.$nextTick();

      const toast = wrapper.find('.toast');
      expect(toast.classes()).toContain('toast-warning');
    });

    it('should apply info class for info toast', async () => {
      toastStore.info('Info message', 0);
      await wrapper.vm.$nextTick();

      const toast = wrapper.find('.toast');
      expect(toast.classes()).toContain('toast-info');
    });
  });

  describe('Toast Removal', () => {
    it('should call removeToast when toast is removed from store', async () => {
      const id = toastStore.showToast('Test removal', 'info', 0);
      await wrapper.vm.$nextTick();

      expect(wrapper.findAll('.toast')).toHaveLength(1);

      // Remove from store directly
      toastStore.removeToast(id);
      await wrapper.vm.$nextTick();

      expect(wrapper.findAll('.toast')).toHaveLength(0);
    });

    it('should render close button', async () => {
      toastStore.showToast('With close button', 'info', 0);
      await wrapper.vm.$nextTick();

      const closeBtn = wrapper.find('.toast-close');
      expect(closeBtn.exists()).toBe(true);
    });

    it('should update when toast is removed from store', async () => {
      toastStore.showToast('First', 'info', 0);
      const id2 = toastStore.showToast('Second', 'info', 0);
      toastStore.showToast('Third', 'info', 0);
      await wrapper.vm.$nextTick();

      expect(wrapper.findAll('.toast')).toHaveLength(3);

      // Remove second toast from store
      toastStore.removeToast(id2);
      await wrapper.vm.$nextTick();

      expect(wrapper.findAll('.toast')).toHaveLength(2);
      
      // Verify correct toasts remain
      const messages = wrapper.findAll('.toast-message');
      expect(messages[0].text()).toBe('First');
      expect(messages[1].text()).toBe('Third');
    });
  });

  describe('Multiple Toasts', () => {
    it('should render toasts in order', async () => {
      toastStore.showToast('First', 'info', 0);
      toastStore.showToast('Second', 'info', 0);
      toastStore.showToast('Third', 'info', 0);
      await wrapper.vm.$nextTick();

      const messages = wrapper.findAll('.toast-message');
      expect(messages[0].text()).toBe('First');
      expect(messages[1].text()).toBe('Second');
      expect(messages[2].text()).toBe('Third');
    });

    it('should handle different types simultaneously', async () => {
      toastStore.success('Success', 0);
      toastStore.error('Error', 0);
      toastStore.warning('Warning', 0);
      toastStore.info('Info', 0);
      await wrapper.vm.$nextTick();

      const toasts = wrapper.findAll('.toast');
      expect(toasts).toHaveLength(4);
      
      expect(toasts[0].classes()).toContain('toast-success');
      expect(toasts[1].classes()).toContain('toast-error');
      expect(toasts[2].classes()).toContain('toast-warning');
      expect(toasts[3].classes()).toContain('toast-info');
    });
  });
});
