import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import AppSidebar from '../../src/renderer/components/AppSidebar.vue';
import { createPinia, setActivePinia } from 'pinia';

describe('Shortcut Info in Sidebar', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('Info Tab Content', () => {
    it('should display keyboard shortcuts section', async () => {
      const wrapper = mount(AppSidebar, {
        props: {
          isOpen: true
        }
      });
      
      // Switch to Info tab
      const tabs = wrapper.findAll('.tab');
      await tabs[1].trigger('click');
      
      const infoContent = wrapper.find('.info-content');
      expect(infoContent.exists()).toBe(true);
      expect(infoContent.text()).toContain('Keyboard Shortcuts');
    });

    it('should display undo shortcut (Ctrl+Z)', async () => {
      const wrapper = mount(AppSidebar, {
        props: {
          isOpen: true
        }
      });
      
      const tabs = wrapper.findAll('.tab');
      await tabs[1].trigger('click');
      
      const shortcuts = wrapper.findAll('.shortcut-item');
      const undoShortcut = shortcuts.find(s => s.text().includes('Undo'));
      
      expect(undoShortcut).toBeDefined();
      expect(undoShortcut?.text()).toContain('Ctrl+Z');
    });

    it('should display redo shortcuts (Ctrl+Shift+Z, Ctrl+Y)', async () => {
      const wrapper = mount(AppSidebar, {
        props: {
          isOpen: true
        }
      });
      
      const tabs = wrapper.findAll('.tab');
      await tabs[1].trigger('click');
      
      const shortcuts = wrapper.findAll('.shortcut-item');
      const redoShortcut = shortcuts.find(s => s.text().includes('Redo'));
      
      expect(redoShortcut).toBeDefined();
      expect(redoShortcut?.text()).toContain('Ctrl+Shift+Z');
      expect(redoShortcut?.text()).toContain('Ctrl+Y');
    });

    it('should display copy shortcut (Ctrl+C)', async () => {
      const wrapper = mount(AppSidebar, {
        props: {
          isOpen: true
        }
      });
      
      const tabs = wrapper.findAll('.tab');
      await tabs[1].trigger('click');
      
      const shortcuts = wrapper.findAll('.shortcut-item');
      const copyShortcut = shortcuts.find(s => s.text().includes('Copy'));
      
      expect(copyShortcut).toBeDefined();
      expect(copyShortcut?.text()).toContain('Ctrl+C');
    });

    it('should display paste shortcut (Ctrl+V)', async () => {
      const wrapper = mount(AppSidebar, {
        props: {
          isOpen: true
        }
      });
      
      const tabs = wrapper.findAll('.tab');
      await tabs[1].trigger('click');
      
      const shortcuts = wrapper.findAll('.shortcut-item');
      const pasteShortcut = shortcuts.find(s => s.text().includes('Paste'));
      
      expect(pasteShortcut).toBeDefined();
      expect(pasteShortcut?.text()).toContain('Ctrl+V');
    });

    it('should display delete shortcut (Delete)', async () => {
      const wrapper = mount(AppSidebar, {
        props: {
          isOpen: true
        }
      });
      
      const tabs = wrapper.findAll('.tab');
      await tabs[1].trigger('click');
      
      const shortcuts = wrapper.findAll('.shortcut-item');
      const deleteShortcut = shortcuts.find(s => s.text().includes('Delete'));
      
      expect(deleteShortcut).toBeDefined();
      expect(deleteShortcut?.text()).toContain('Delete');
    });

    it('should display escape shortcut (ESC)', async () => {
      const wrapper = mount(AppSidebar, {
        props: {
          isOpen: true
        }
      });
      
      const tabs = wrapper.findAll('.tab');
      await tabs[1].trigger('click');
      
      const shortcuts = wrapper.findAll('.shortcut-item');
      const escShortcut = shortcuts.find(s => s.text().includes('Cancel') || s.text().includes('Deselect'));
      
      expect(escShortcut).toBeDefined();
      expect(escShortcut?.text()).toContain('ESC');
    });

    it('should group shortcuts by category', async () => {
      const wrapper = mount(AppSidebar, {
        props: {
          isOpen: true
        }
      });
      
      const tabs = wrapper.findAll('.tab');
      await tabs[1].trigger('click');
      
      const categories = wrapper.findAll('.shortcut-category');
      expect(categories.length).toBeGreaterThan(0);
      
      // Should have categories like "Editing", "Selection", etc.
      const categoryTexts = categories.map(c => c.text());
      expect(categoryTexts.some(t => t.includes('Edit'))).toBe(true);
    });

    it('should display app version information', async () => {
      const wrapper = mount(AppSidebar, {
        props: {
          isOpen: true
        }
      });
      
      const tabs = wrapper.findAll('.tab');
      await tabs[1].trigger('click');
      
      const infoContent = wrapper.find('.info-content');
      expect(infoContent.text()).toContain('Version');
      expect(infoContent.text()).toContain('0.1.0');
    });
  });
});
