import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ConfirmModal from '../../src/renderer/components/ConfirmModal.vue';

describe('ConfirmModal Component', () => {
  let wrapper: any;

  describe('Rendering', () => {
    it('should render modal when isOpen is true', () => {
      wrapper = mount(ConfirmModal, {
        props: {
          isOpen: true,
          title: 'Test Title',
          message: 'Test Message',
        },
      });

      expect(wrapper.find('.modal-overlay').exists()).toBe(true);
      expect(wrapper.find('.modal-content').exists()).toBe(true);
    });

    it('should not render modal when isOpen is false', () => {
      wrapper = mount(ConfirmModal, {
        props: {
          isOpen: false,
          title: 'Test Title',
          message: 'Test Message',
        },
      });

      expect(wrapper.find('.modal-overlay').exists()).toBe(false);
    });

    it('should display correct title', () => {
      wrapper = mount(ConfirmModal, {
        props: {
          isOpen: true,
          title: 'Delete Confirmation',
          message: 'Test',
        },
      });

      expect(wrapper.find('.modal-title').text()).toBe('Delete Confirmation');
    });

    it('should display correct message', () => {
      wrapper = mount(ConfirmModal, {
        props: {
          isOpen: true,
          title: 'Test',
          message: 'Are you sure you want to proceed?',
        },
      });

      expect(wrapper.find('.modal-message').text()).toBe('Are you sure you want to proceed?');
    });

    it('should render cancel button', () => {
      wrapper = mount(ConfirmModal, {
        props: {
          isOpen: true,
          title: 'Test',
          message: 'Test',
        },
      });

      const cancelBtn = wrapper.find('.btn-cancel');
      expect(cancelBtn.exists()).toBe(true);
      expect(cancelBtn.text()).toBe('Cancel');
    });

    it('should render confirm button', () => {
      wrapper = mount(ConfirmModal, {
        props: {
          isOpen: true,
          title: 'Test',
          message: 'Test',
        },
      });

      const confirmBtn = wrapper.find('.btn-confirm');
      expect(confirmBtn.exists()).toBe(true);
      expect(confirmBtn.text()).toBe('Confirm');
    });
  });

  describe('User Interactions', () => {
    beforeEach(() => {
      wrapper = mount(ConfirmModal, {
        props: {
          isOpen: true,
          title: 'Test Title',
          message: 'Test Message',
        },
      });
    });

    it('should emit confirm event when confirm button is clicked', async () => {
      const confirmBtn = wrapper.find('.btn-confirm');
      await confirmBtn.trigger('click');

      expect(wrapper.emitted('confirm')).toBeTruthy();
      expect(wrapper.emitted('confirm')).toHaveLength(1);
    });

    it('should emit cancel event when cancel button is clicked', async () => {
      const cancelBtn = wrapper.find('.btn-cancel');
      await cancelBtn.trigger('click');

      expect(wrapper.emitted('cancel')).toBeTruthy();
      expect(wrapper.emitted('cancel')).toHaveLength(1);
    });

    it('should emit cancel event when overlay is clicked', async () => {
      const overlay = wrapper.find('.modal-overlay');
      await overlay.trigger('click');

      expect(wrapper.emitted('cancel')).toBeTruthy();
    });

    it('should not emit cancel when clicking inside modal content', async () => {
      const modalContent = wrapper.find('.modal-content');
      await modalContent.trigger('click');

      expect(wrapper.emitted('cancel')).toBeFalsy();
    });
  });
});
