import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import Sidebar from '../../src/renderer/components/Sidebar.vue';
import { createPinia, setActivePinia } from 'pinia';

describe('Sidebar Component', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('Sidebar State', () => {
    it('should be closed by default', () => {
      const wrapper = mount(Sidebar);
      
      expect(wrapper.find('.sidebar').classes()).toContain('closed');
      expect(wrapper.find('.sidebar').isVisible()).toBe(true);
    });

    it('should open when isOpen prop is true', () => {
      const wrapper = mount(Sidebar, {
        props: {
          isOpen: true
        }
      });
      
      expect(wrapper.find('.sidebar').classes()).not.toContain('closed');
      expect(wrapper.find('.sidebar-content').isVisible()).toBe(true);
    });

    it('should close when isOpen prop is false', () => {
      const wrapper = mount(Sidebar, {
        props: {
          isOpen: false
        }
      });
      
      expect(wrapper.find('.sidebar').classes()).toContain('closed');
    });

    it('should emit close event when close button is clicked', async () => {
      const wrapper = mount(Sidebar, {
        props: {
          isOpen: true
        }
      });
      
      await wrapper.find('.close-button').trigger('click');
      
      expect(wrapper.emitted('close')).toBeTruthy();
      expect(wrapper.emitted('close')?.length).toBe(1);
    });
  });

  describe('Tab Navigation', () => {
    it('should show Settings tab by default', () => {
      const wrapper = mount(Sidebar, {
        props: {
          isOpen: true
        }
      });
      
      expect(wrapper.find('.tab.active').text()).toContain('Settings');
      expect(wrapper.find('.settings-content').exists()).toBe(true);
    });

    it('should switch to Info tab when clicked', async () => {
      const wrapper = mount(Sidebar, {
        props: {
          isOpen: true
        }
      });
      
      const tabs = wrapper.findAll('.tab');
      await tabs[1].trigger('click'); // Click Info tab
      
      expect(tabs[1].classes()).toContain('active');
      expect(wrapper.find('.info-content').exists()).toBe(true);
    });

    it('should switch back to Settings tab when clicked', async () => {
      const wrapper = mount(Sidebar, {
        props: {
          isOpen: true
        }
      });
      
      const tabs = wrapper.findAll('.tab');
      await tabs[1].trigger('click'); // Click Info tab
      await tabs[0].trigger('click'); // Click Settings tab
      
      expect(tabs[0].classes()).toContain('active');
      expect(wrapper.find('.settings-content').exists()).toBe(true);
    });

    it('should maintain tab state when sidebar is closed and reopened', async () => {
      const wrapper = mount(Sidebar, {
        props: {
          isOpen: true
        }
      });
      
      // Switch to Info tab
      const tabs = wrapper.findAll('.tab');
      await tabs[1].trigger('click');
      
      // Close sidebar
      await wrapper.setProps({ isOpen: false });
      
      // Reopen sidebar
      await wrapper.setProps({ isOpen: true });
      
      // Should still be on Info tab
      expect(tabs[1].classes()).toContain('active');
      expect(wrapper.find('.info-content').exists()).toBe(true);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should close when Escape key is pressed', async () => {
      const wrapper = mount(Sidebar, {
        props: {
          isOpen: true
        }
      });
      
      await wrapper.trigger('keydown.esc');
      
      expect(wrapper.emitted('close')).toBeTruthy();
    });
  });
});
