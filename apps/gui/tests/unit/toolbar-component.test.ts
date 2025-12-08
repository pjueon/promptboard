import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AppToolbar from '../../src/renderer/components/AppToolbar.vue';
import ConfirmModal from '../../src/renderer/components/ConfirmModal.vue';
import { useToolbarStore, Tool } from '../../src/renderer/stores/toolbarStore';

describe('Toolbar Component', () => {
  let wrapper: VueWrapper;
  let store: ReturnType<typeof useToolbarStore>;

  beforeEach(() => {
    // Create fresh pinia instance
    const pinia = createPinia();
    setActivePinia(pinia);
    store = useToolbarStore();

    // Mount component
    wrapper = mount(AppToolbar, {
      global: {
        plugins: [pinia],
        components: {
          ConfirmModal,
        },
      },
    });
  });

  describe('Tool Button Clicks', () => {
    it('should call setTool with pen when pen button is clicked', async () => {
      const spy = vi.spyOn(store, 'setTool');
      
      const penBtn = wrapper.find('[data-testid="tool-btn-pen"]');
      await penBtn.trigger('click');
      
      expect(spy).toHaveBeenCalledWith('pen');
    });

    it('should call setTool with select when select button is clicked', async () => {
      const spy = vi.spyOn(store, 'setTool');
      
      const selectBtn = wrapper.find('[data-testid="tool-btn-select"]');
      await selectBtn.trigger('click');
      
      expect(spy).toHaveBeenCalledWith('select');
    });

    it('should call setTool with eraser when eraser button is clicked', async () => {
      const spy = vi.spyOn(store, 'setTool');
      
      const eraserBtn = wrapper.find('[data-testid="tool-btn-eraser"]');
      await eraserBtn.trigger('click');
      
      expect(spy).toHaveBeenCalledWith('eraser');
    });

    it('should call setTool with line when line button is clicked', async () => {
      const spy = vi.spyOn(store, 'setTool');
      
      const lineBtn = wrapper.find('[data-testid="tool-btn-line"]');
      await lineBtn.trigger('click');
      
      expect(spy).toHaveBeenCalledWith('line');
    });

    it('should call setTool with arrow when arrow button is clicked', async () => {
      const spy = vi.spyOn(store, 'setTool');
      
      const arrowBtn = wrapper.find('[data-testid="tool-btn-arrow"]');
      await arrowBtn.trigger('click');
      
      expect(spy).toHaveBeenCalledWith('arrow');
    });

    it('should call setTool with rectangle when rectangle button is clicked', async () => {
      const spy = vi.spyOn(store, 'setTool');
      
      const rectangleBtn = wrapper.find('[data-testid="tool-btn-rectangle"]');
      await rectangleBtn.trigger('click');
      
      expect(spy).toHaveBeenCalledWith('rectangle');
    });

    it('should call setTool with ellipse when ellipse button is clicked', async () => {
      const spy = vi.spyOn(store, 'setTool');
      
      const ellipseBtn = wrapper.find('[data-testid="tool-btn-ellipse"]');
      await ellipseBtn.trigger('click');
      
      expect(spy).toHaveBeenCalledWith('ellipse');
    });

    it('should call setTool with text when text button is clicked', async () => {
      const spy = vi.spyOn(store, 'setTool');
      
      const textBtn = wrapper.find('[data-testid="tool-btn-text"]');
      await textBtn.trigger('click');
      
      expect(spy).toHaveBeenCalledWith('text');
    });
  });

  describe('Color Picker', () => {
    it('should call setColor when color input changes', async () => {
      const spy = vi.spyOn(store, 'setColor');
      
      const colorPicker = wrapper.find('[data-testid="color-picker"]');
      await colorPicker.setValue('#ff0000');
      
      expect(spy).toHaveBeenCalledWith('#ff0000');
    });

    it('should display current color from store', async () => {
      store.setColor('#0000ff');
      await wrapper.vm.$nextTick();
      
      const colorPicker = wrapper.find('[data-testid="color-picker"]');
      expect((colorPicker.element as HTMLInputElement).value).toBe('#0000ff');
    });

    it('should update displayed color when store changes', async () => {
      const colorPicker = wrapper.find('[data-testid="color-picker"]');
      
      store.setColor('#00ff00');
      await wrapper.vm.$nextTick();
      
      expect((colorPicker.element as HTMLInputElement).value).toBe('#00ff00');
    });
  });

  describe('Stroke Width Slider', () => {
    it('should call setStrokeWidth when slider changes', async () => {
      const spy = vi.spyOn(store, 'setStrokeWidth');
      
      const slider = wrapper.find('[data-testid="stroke-slider"]');
      await slider.setValue('8');
      
      expect(spy).toHaveBeenCalledWith(8);
    });

    it('should display current width from store', async () => {
      store.setStrokeWidth(10);
      await wrapper.vm.$nextTick();
      
      const slider = wrapper.find('[data-testid="stroke-slider"]');
      expect((slider.element as HTMLInputElement).value).toBe('10');
    });

    it('should display stroke value in label', async () => {
      store.setStrokeWidth(5);
      await wrapper.vm.$nextTick();

      const labels = wrapper.findAll('.tool-label');
      const strokeLabel = labels.find((l) => l.text().includes('Stroke:'));
      expect(strokeLabel!.text()).toContain('5px');
    });

    it('should update label when slider changes', async () => {
      const slider = wrapper.find('[data-testid="stroke-slider"]');
      await slider.setValue('15');
      await wrapper.vm.$nextTick();
      
      const labels = wrapper.findAll('.tool-label');
      const widthLabel = labels.find((l) => l.text().includes('px'));
      expect(widthLabel!.text()).toContain('15px');
    });
  });

  describe('Active State', () => {
    it('should apply active class to pen button by default', () => {
      const penBtn = wrapper.find('[data-testid="tool-btn-pen"]');
      expect(penBtn.classes()).toContain('active');
    });

    it('should apply active class to currently selected tool', async () => {
      store.setTool('select');
      await wrapper.vm.$nextTick();
      
      const selectBtn = wrapper.find('[data-testid="tool-btn-select"]');
      expect(selectBtn.classes()).toContain('active');
    });

    it('should remove active class from other tools', async () => {
      store.setTool('ellipse');
      await wrapper.vm.$nextTick();
      
      const penBtn = wrapper.find('[data-testid="tool-btn-pen"]');
      const ellipseBtn = wrapper.find('[data-testid="tool-btn-ellipse"]');
      expect(penBtn.classes()).not.toContain('active');
      expect(ellipseBtn.classes()).toContain('active');
    });

    it('should update active state when tool changes', async () => {
      const penBtn = wrapper.find('[data-testid="tool-btn-pen"]');
      const rectangleBtn = wrapper.find('[data-testid="tool-btn-rectangle"]');
      
      // Initially pen is active
      expect(penBtn.classes()).toContain('active');
      
      // Change to rectangle
      store.setTool('rectangle');
      await wrapper.vm.$nextTick();
      
      expect(penBtn.classes()).not.toContain('active');
      expect(rectangleBtn.classes()).toContain('active');
    });
  });

  describe('Rendering', () => {
    it('should render all 8 tool buttons', () => {
      const tools = ['pen', 'select', 'eraser', 'line', 'arrow', 'rectangle', 'ellipse', 'text'];
      tools.forEach(tool => {
        const btn = wrapper.find(`[data-testid="tool-btn-${tool}"]`);
        expect(btn.exists()).toBe(true);
      });
    });

    it('should render action buttons', () => {
      expect(wrapper.find('[data-testid="save-btn"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="clear-btn"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="settings-btn"]').exists()).toBe(true);
    });

    it('should render color picker input', () => {
      const colorPicker = wrapper.find('[data-testid="color-picker"]');
      expect(colorPicker.exists()).toBe(true);
      expect(colorPicker.attributes('type')).toBe('color');
    });

    it('should render stroke width slider', () => {
      const slider = wrapper.find('[data-testid="stroke-slider"]');
      expect(slider.exists()).toBe(true);
      expect(slider.attributes('type')).toBe('range');
    });

    it('should have correct slider range', () => {
      const slider = wrapper.find('[data-testid="stroke-slider"]');
      expect(slider.attributes('min')).toBe('1');
      expect(slider.attributes('max')).toBe('20');
    });
  });

  describe('Font Size Slider', () => {
    it('should show font size slider when text tool is selected', async () => {
      store.setTool('text');
      await wrapper.vm.$nextTick();
      
      const fontSlider = wrapper.find('[data-testid="font-slider"]');
      expect(fontSlider.exists()).toBe(true);
    });

    it('should hide font size slider when pen tool is selected', async () => {
      store.setTool('pen');
      await wrapper.vm.$nextTick();
      
      const fontSlider = wrapper.find('[data-testid="font-slider"]');
      expect(fontSlider.exists()).toBe(false);
    });

    it('should hide font size slider when other tools are selected', async () => {
      const tools: Tool[] = ['pen', 'select', 'eraser', 'line', 'arrow', 'rectangle', 'ellipse'];

      for (const tool of tools) {
        store.setTool(tool);
        await wrapper.vm.$nextTick();

        const fontSlider = wrapper.find('[data-testid="font-slider"]');
        expect(fontSlider.exists()).toBe(false);
      }
    });

    it('should call setFontSize when slider changes', async () => {
      const spy = vi.spyOn(store, 'setFontSize');
      
      store.setTool('text');
      await wrapper.vm.$nextTick();
      
      const fontSlider = wrapper.find('[data-testid="font-slider"]');
      await fontSlider.setValue('36');
      
      expect(spy).toHaveBeenCalledWith(36);
    });

    it('should display current font size from store', async () => {
      store.setTool('text');
      store.setFontSize(24);
      await wrapper.vm.$nextTick();
      
      const fontSlider = wrapper.find('[data-testid="font-slider"]');
      expect((fontSlider.element as HTMLInputElement).value).toBe('24');
    });

    it('should display font size value in label', async () => {
      store.setTool('text');
      store.setFontSize(48);
      await wrapper.vm.$nextTick();
      
      const labels = wrapper.findAll('.tool-label');
      const fontLabel = labels.find((l) => l.text().includes('Font:'));
      expect(fontLabel!.text()).toContain('48px');
    });

    it('should have correct slider range', async () => {
      store.setTool('text');
      await wrapper.vm.$nextTick();
      
      const fontSlider = wrapper.find('[data-testid="font-slider"]');
      expect(fontSlider.attributes('min')).toBe('12');
      expect(fontSlider.attributes('max')).toBe('72');
    });
  });

  describe('Clear All Button', () => {
    it('should render clear button', () => {
      const clearBtn = wrapper.find('[data-testid="clear-btn"]');
      expect(clearBtn.exists()).toBe(true);
    });

    it('should show modal when clear button is clicked', async () => {
      const clearBtn = wrapper.find('[data-testid="clear-btn"]');
      await clearBtn.trigger('click');
      await wrapper.vm.$nextTick();

      const modal = wrapper.findComponent(ConfirmModal);
      expect(modal.props('isOpen')).toBe(true);
    });

    it('should emit clearAll event when modal confirms', async () => {
      const clearBtn = wrapper.find('[data-testid="clear-btn"]');
      await clearBtn.trigger('click');
      await wrapper.vm.$nextTick();

      const modal = wrapper.findComponent(ConfirmModal);
      await modal.vm.$emit('confirm');
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted('clearAll')).toBeTruthy();
      expect(wrapper.emitted('clearAll')).toHaveLength(1);
    });

    it('should close modal when cancel is clicked', async () => {
      const clearBtn = wrapper.find('[data-testid="clear-btn"]');
      await clearBtn.trigger('click');
      await wrapper.vm.$nextTick();

      let modal = wrapper.findComponent(ConfirmModal);
      expect(modal.props('isOpen')).toBe(true);

      await modal.vm.$emit('cancel');
      await wrapper.vm.$nextTick();

      modal = wrapper.findComponent(ConfirmModal);
      expect(modal.props('isOpen')).toBe(false);
    });

    it('should not emit clearAll when cancel is clicked', async () => {
      const clearBtn = wrapper.find('[data-testid="clear-btn"]');
      await clearBtn.trigger('click');
      await wrapper.vm.$nextTick();

      const modal = wrapper.findComponent(ConfirmModal);
      await modal.vm.$emit('cancel');
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted('clearAll')).toBeFalsy();
    });
  });
});
