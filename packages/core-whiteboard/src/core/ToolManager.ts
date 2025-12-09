import type { fabric } from 'fabric';
import type { ToolType, ToolConfig, CleanupFunction } from '../types/index';
import type { Tool } from '../tools/base/Tool';

/**
 * Manages tools and their activation/deactivation
 */
export class ToolManager {
  private canvas: fabric.Canvas;
  private tools: Map<ToolType, Tool>;
  private activeTool: Tool | null = null;
  private activeToolType: ToolType | null = null;
  private config: ToolConfig;

  constructor(canvas: fabric.Canvas, config: ToolConfig) {
    this.canvas = canvas;
    this.tools = new Map();
    this.config = config;
  }

  /**
   * Register a tool
   */
  registerTool(type: ToolType, tool: Tool): void {
    this.tools.set(type, tool);
  }

  /**
   * Activate a tool
   */
  activateTool(type: ToolType): void {
    // Deactivate current tool
    if (this.activeTool) {
      this.activeTool.deactivate();
    }

    // Get and activate new tool
    const tool = this.tools.get(type);
    if (!tool) {
      throw new Error(`Tool not found: ${type}`);
    }

    // Reset canvas state before activating tool
    // This ensures a clean state for the tool to configure
    this.canvas.isDrawingMode = false;
    this.canvas.selection = true;

    // Update tool config before activating
    tool.updateConfig(this.config);

    // Activate tool (tool can override canvas state as needed)
    tool.activate();
    this.activeTool = tool;
    this.activeToolType = type;
  }

  /**
   * Get current active tool type
   */
  getActiveToolType(): ToolType | null {
    return this.activeToolType;
  }

  /**
   * Check if the current tool is in a drawing state
   */
  isDrawing(): boolean {
    if (!this.activeTool) {
      return false;
    }
    return this.activeTool.isDrawing();
  }

  /**
   * Update tool configuration
   */
  updateConfig(config: Partial<ToolConfig>): void {
    this.config = { ...this.config, ...config };

    // Apply to active tool if needed
    if (this.activeTool) {
      this.activeTool.updateConfig(this.config);
    }
  }

  /**
   * Get current tool configuration
   */
  getConfig(): ToolConfig {
    return { ...this.config };
  }

  /**
   * Cleanup all tools
   */
  dispose(): void {
    if (this.activeTool) {
      this.activeTool.deactivate();
    }
    this.tools.clear();
  }
}
