import { defineStore } from 'pinia';
import { ref } from 'vue';

export type Tool = 'pen' | 'eraser' | 'select' | 'line' | 'rectangle' | 'circle' | 'text';

export const useToolbarStore = defineStore('toolbar', () => {
  // State
  const currentTool = ref<Tool>('pen');
  const color = ref<string>('#000000');
  const strokeWidth = ref<number>(2);
  const fontSize = ref<number>(20);

  // Actions
  function setTool(tool: Tool) {
    currentTool.value = tool;
  }

  function setColor(newColor: string) {
    color.value = newColor;
  }

  function setStrokeWidth(width: number) {
    strokeWidth.value = width;
  }

  function setFontSize(size: number) {
    fontSize.value = size;
  }

  return {
    currentTool,
    color,
    strokeWidth,
    fontSize,
    setTool,
    setColor,
    setStrokeWidth,
    setFontSize,
  };
});
