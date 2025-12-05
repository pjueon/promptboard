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
      
      const buttons = wrapper.findAll('.tool-btn');
      await buttons[0].trigger('click'); // First button is pen
      
      expect(spy).toHaveBeenCalledWith('pen');
    });

    it('should call setTool with select when select button is clicked', async () => {
      const spy = vi.spyOn(store, 'setTool');
      
      const buttons = wrapper.findAll('.tool-btn');
      await buttons[1].trigger('click'); // Second button is select
      
      expect(spy).toHaveBeenCalledWith('select');
    });

    it('should call setTool with eraser when eraser button is clicked', async () => {
      const spy = vi.spyOn(store, 'setTool');
      
      const buttons = wrapper.findAll('.tool-btn');
      await buttons[2].trigger('click'); // Third button is eraser
      
      expect(spy).toHaveBeenCalledWith('eraser');
    });

    it('should call setTool with line when line button is clicked', async () => {
      const spy = vi.spyOn(store, 'setTool');
      
      const buttons = wrapper.findAll('.tool-btn');
      await buttons[3].trigger('click'); // Fourth button is line
      
      expect(spy).toHaveBeenCalledWith('line');
    });

    it('should call setTool with rectangle when rectangle button is clicked', async () => {
      const spy = vi.spyOn(store, 'setTool');
      
      const buttons = wrapper.findAll('.tool-btn');
      await buttons[4].trigger('click'); // Fifth button is rectangle
      
      expect(spy).toHaveBeenCalledWith('rectangle');
    });

    it('should call setTool with ellipse when ellipse button is clicked', async () => {
      const spy = vi.spyOn(store, 'setTool');
      
      const buttons = wrapper.findAll('.tool-btn');
      await buttons[5].trigger('click'); // Sixth button is ellipse
      
      expect(spy).toHaveBeenCalledWith('ellipse');
    });

    it('should call setTool with text when text button is clicked', async () => {
      const spy = vi.spyOn(store, 'setTool');
      
      const buttons = wrapper.findAll('.tool-btn');
      await buttons[6].trigger('click'); // Seventh button is text
      
      expect(spy).toHaveBeenCalledWith('text');
    });
  });

  describe('Color Picker', () => {
    it('should call setColor when color input changes', async () => {
      const spy = vi.spyOn(store, 'setColor');
      
      const colorPicker = wrapper.find('.color-picker');
      await colorPicker.setValue('#ff0000');
      
      expect(spy).toHaveBeenCalledWith('#ff0000');
    });

    it('should display current color from store', async () => {
      store.setColor('#0000ff');
      await wrapper.vm.$nextTick();
      
      const colorPicker = wrapper.find('.color-picker');
      expect((colorPicker.element as HTMLInputElement).value).toBe('#0000ff');
    });

    it('should update displayed color when store changes', async () => {
      const colorPicker = wrapper.find('.color-picker');
      
      store.setColor('#00ff00');
      await wrapper.vm.$nextTick();
      
      expect((colorPicker.element as HTMLInputElement).value).toBe('#00ff00');
    });
  });

  describe('Stroke Width Slider', () => {
    it('should call setStrokeWidth when slider changes', async () => {
      const spy = vi.spyOn(store, 'setStrokeWidth');
      
      const slider = wrapper.find('.stroke-slider');
      await slider.setValue('8');
      
      expect(spy).toHaveBeenCalledWith(8);
    });

    it('should display current width from store', async () => {
      store.setStrokeWidth(10);
      await wrapper.vm.$nextTick();
      
      const slider = wrapper.find('.stroke-slider');
      expect((slider.element as HTMLInputElement).value).toBe('10');
    });

    it('should display width value in label', async () => {
      store.setStrokeWidth(5);
      await wrapper.vm.$nextTick();
      
      const labels = wrapper.findAll('.tool-label');
      const widthLabel = labels.find((l) => l.text().includes('Width:'));
      expect(widthLabel!.text()).toContain('5px');
    });

    it('should update label when slider changes', async () => {
      const slider = wrapper.find('.stroke-slider');
      await slider.setValue('15');
      await wrapper.vm.$nextTick();
      
      const labels = wrapper.findAll('.tool-label');
      const widthLabel = labels.find((l) => l.text().includes('px'));
      expect(widthLabel!.text()).toContain('15px');
    });
  });

  describe('Active State', () => {
    it('should apply active class to pen button by default', () => {
      const buttons = wrapper.findAll('.tool-btn');
      expect(buttons[0].classes()).toContain('active');
    });

    it('should apply active class to currently selected tool', async () => {
      store.setTool('select');
      await wrapper.vm.$nextTick();
      
      const buttons = wrapper.findAll('.tool-btn');
      expect(buttons[1].classes()).toContain('active');
    });

    it('should remove active class from other tools', async () => {
      store.setTool('ellipse');
      await wrapper.vm.$nextTick();
      
      const buttons = wrapper.findAll('.tool-btn');
      expect(buttons[0].classes()).not.toContain('active'); // pen
      expect(buttons[5].classes()).toContain('active'); // ellipse
    });

    it('should update active state when tool changes', async () => {
      const buttons = wrapper.findAll('.tool-btn');
      
      // Initially pen is active
      expect(buttons[0].classes()).toContain('active');
      
      // Change to rectangle
      store.setTool('rectangle');
      await wrapper.vm.$nextTick();
      
      expect(buttons[0].classes()).not.toContain('active');
      expect(buttons[4].classes()).toContain('active');
    });
  });

  describe('Rendering', () => {
    it('should render 7 tool buttons', () => {
      const toolButtons = wrapper.findAll('.tool-group')[0].findAll('.tool-btn');
      expect(toolButtons).toHaveLength(7);
    });

    it('should render 9 buttons total including clear and settings buttons', () => {
      const allButtons = wrapper.findAll('.tool-btn');
      expect(allButtons).toHaveLength(9);
    });

    it('should render color picker input', () => {
      const colorPicker = wrapper.find('.color-picker');
      expect(colorPicker.exists()).toBe(true);
      expect(colorPicker.attributes('type')).toBe('color');
    });

    it('should render stroke width slider', () => {
      const slider = wrapper.find('.stroke-slider');
      expect(slider.exists()).toBe(true);
      expect(slider.attributes('type')).toBe('range');
    });

    it('should have correct slider range', () => {
      const slider = wrapper.find('.stroke-slider');
      expect(slider.attributes('min')).toBe('1');
      expect(slider.attributes('max')).toBe('20');
    });
  });

  describe('Font Size Slider', () => {
    it('should show font size slider when text tool is selected', async () => {
      store.setTool('text');
      await wrapper.vm.$nextTick();
      
      const fontSlider = wrapper.find('.font-slider');
      expect(fontSlider.exists()).toBe(true);
    });

    it('should hide font size slider when pen tool is selected', async () => {
      store.setTool('pen');
      await wrapper.vm.$nextTick();
      
      const fontSlider = wrapper.find('.font-slider');
      expect(fontSlider.exists()).toBe(false);
    });

    it('should hide font size slider when other tools are selected', async () => {
      const tools: Tool[] = ['pen', 'select', 'eraser', 'line', 'rectangle', 'ellipse'];

      for (const tool of tools) {
        store.setTool(tool);
        await wrapper.vm.$nextTick();

        const fontSlider = wrapper.find('.font-slider');
        expect(fontSlider.exists()).toBe(false);
      }
    });

    it('should call setFontSize when slider changes', async () => {
      const spy = vi.spyOn(store, 'setFontSize');
      
      store.setTool('text');
      await wrapper.vm.$nextTick();
      
      const fontSlider = wrapper.find('.font-slider');
      await fontSlider.setValue('36');
      
      expect(spy).toHaveBeenCalledWith(36);
    });

    it('should display current font size from store', async () => {
      store.setTool('text');
      store.setFontSize(24);
      await wrapper.vm.$nextTick();
      
      const fontSlider = wrapper.find('.font-slider');
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
      
      const fontSlider = wrapper.find('.font-slider');
      expect(fontSlider.attributes('min')).toBe('12');
      expect(fontSlider.attributes('max')).toBe('72');
    });
  });

  describe('Clear All Button', () => {
    it('should render clear button', () => {
      const clearBtn = wrapper.find('.clear-btn');
      expect(clearBtn.exists()).toBe(true);
    });

    it('should show modal when clear button is clicked', async () => {
      const clearBtn = wrapper.find('.clear-btn');
      await clearBtn.trigger('click');
      await wrapper.vm.$nextTick();

      const modal = wrapper.findComponent(ConfirmModal);
      expect(modal.props('isOpen')).toBe(true);
    });

    it('should emit clearAll event when modal confirms', async () => {
      const clearBtn = wrapper.find('.clear-btn');
      await clearBtn.trigger('click');
      await wrapper.vm.$nextTick();

      const modal = wrapper.findComponent(ConfirmModal);
      await modal.vm.$emit('confirm');
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted('clearAll')).toBeTruthy();
      expect(wrapper.emitted('clearAll')).toHaveLength(1);
    });

    it('should close modal when cancel is clicked', async () => {
      const clearBtn = wrapper.find('.clear-btn');
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
      const clearBtn = wrapper.find('.clear-btn');
      await clearBtn.trigger('click');
      await wrapper.vm.$nextTick();

      const modal = wrapper.findComponent(ConfirmModal);
      await modal.vm.$emit('cancel');
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted('clearAll')).toBeFalsy();
    });
  });
});
