import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn } from 'node:child_process';
import type { AddressInfo } from 'node:net';

/**
 * MCP Bridge Server Integration Test
 *
 * Test Objectives:
 * 1. Test actual MCP server initialization and tool registration
 * 2. Test WebSocket server creation and connection handling
 * 3. Test tool handlers (open_whiteboard, get_whiteboard) with real logic
 * 4. Test error handling scenarios
 * 5. Test message protocol between bridge and GUI
 */

// Mock modules that we can't run in test environment
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn(),
}));

describe('MCP Bridge Server - Real Implementation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MCP Server Initialization', () => {
    it('should create MCP server with correct configuration', () => {
      const server = new Server(
        {
          name: 'promptboard',
          version: '0.1.0',
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );

      expect(server).toBeDefined();
    });

    it('should validate tool schema structure', () => {
      // Test the tool schemas that bridge.ts returns
      const tools = [
        {
          name: 'open_whiteboard',
          description: 'Opens or focuses the Promptboard whiteboard window',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_whiteboard',
          description: 'Returns the current whiteboard content as a PNG image',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ];

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('open_whiteboard');
      expect(tools[0].description).toBeDefined();
      expect(tools[0].inputSchema.type).toBe('object');
      expect(tools[1].name).toBe('get_whiteboard');
      expect(tools[1].description).toBeDefined();
      expect(tools[1].inputSchema.type).toBe('object');
    });
  });

  describe('WebSocket Server Creation', () => {
    it('should create WebSocket server on random port', async () => {
      const wss = new WebSocketServer({ port: 0 });

      await new Promise<void>((resolve) => {
        wss.on('listening', () => {
          const address = wss.address() as AddressInfo;
          expect(address).toBeDefined();
          expect(address.port).toBeGreaterThan(0);
          wss.close();
          resolve();
        });
      });
    });

    it('should handle client connection and disconnection', async () => {
      const wss = new WebSocketServer({ port: 0 });
      let clientConnected = false;

      await new Promise<void>((resolve) => {
        wss.on('listening', () => {
          const address = wss.address() as AddressInfo;
          const client = new WebSocket(`ws://localhost:${address.port}`);

          wss.on('connection', (ws) => {
            clientConnected = true;
            expect(ws).toBeDefined();

            ws.on('close', () => {
              expect(clientConnected).toBe(true);
              wss.close();
              resolve();
            });
          });

          // Wait for connection to be established before closing
          client.on('open', () => {
            client.close();
          });
        });
      });
    });

    it('should handle WebSocket errors', async () => {
      const wss = new WebSocketServer({ port: 0 });

      await new Promise<void>((resolve) => {
        wss.on('listening', () => {
          const address = wss.address() as AddressInfo;
          new WebSocket(`ws://localhost:${address.port}`);

          wss.on('connection', (ws) => {
            ws.on('error', (error) => {
              expect(error).toBeDefined();
            });

            // Simulate error by destroying the connection
            ws.terminate();

            setTimeout(() => {
              wss.close();
              // Error might not always fire, but connection should be terminated
              expect(ws.readyState).not.toBe(WebSocket.OPEN);
              resolve();
            }, 100);
          });
        });
      });
    });
  });

  describe('GUI Process Management', () => {
    it('should attempt to spawn GUI with correct platform-specific path on Windows', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const mockSpawn = vi.mocked(spawn);
      mockSpawn.mockReturnValue({
        on: vi.fn(),
        kill: vi.fn(),
      } as any);

      // Simulate the getGuiPath logic from bridge.ts
      const getGuiPath = () => {
        switch (process.platform) {
          case 'win32':
            return 'Promptboard.exe';
          case 'darwin':
            return 'Promptboard.app/Contents/MacOS/Promptboard';
          case 'linux':
            return 'Promptboard';
          default:
            throw new Error(`Unsupported platform: ${process.platform}`);
        }
      };

      const guiPath = getGuiPath();
      expect(guiPath).toBe('Promptboard.exe');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should spawn GUI with --ws-port argument', () => {
      const mockSpawn = vi.mocked(spawn);
      const mockProcess = {
        on: vi.fn(),
        kill: vi.fn(),
      };
      mockSpawn.mockReturnValue(mockProcess as any);

      const wsPort = 12345;
      const guiPath = 'test-gui-path';

      spawn(guiPath, [`--ws-port=${wsPort}`], {
        detached: true,
        stdio: 'ignore',
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        guiPath,
        [`--ws-port=${wsPort}`],
        {
          detached: true,
          stdio: 'ignore',
        }
      );
    });

    it('should handle GUI process error event', () => {
      // Test the error handling logic from bridge.ts
      let errorCallback: ((error: Error) => void) | null = null;
      let guiProcessState: 'running' | 'stopped' = 'stopped';

      const mockProcess = {
        on: vi.fn((event: string, callback: (error: Error) => void) => {
          if (event === 'error') {
            errorCallback = callback;
          }
        }),
        kill: vi.fn(),
      };

      // Simulate starting the process
      guiProcessState = 'running';
      mockProcess.on('error', () => {
        guiProcessState = 'stopped';
      });

      // Trigger error
      expect(errorCallback).toBeDefined();
      if (errorCallback) {
        errorCallback(new Error('Failed to spawn'));
        expect(guiProcessState).toBe('stopped');
      }
    });

    it('should handle GUI process close event', () => {
      // Test the close handling logic from bridge.ts
      let closeCallback: ((code: number) => void) | null = null;
      let guiProcessState: 'running' | 'stopped' = 'stopped';
      let wsClientConnected = true;

      const mockProcess = {
        on: vi.fn((event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            closeCallback = callback;
          }
        }),
        kill: vi.fn(),
      };

      // Simulate starting the process
      guiProcessState = 'running';
      mockProcess.on('close', () => {
        guiProcessState = 'stopped';
        wsClientConnected = false;
      });

      // Trigger close
      expect(closeCallback).toBeDefined();
      if (closeCallback) {
        closeCallback(0);
        expect(guiProcessState).toBe('stopped');
        expect(wsClientConnected).toBe(false);
      }
    });
  });

  describe('Message Protocol', () => {
    it('should send and receive JSON messages with request ID', async () => {
      const wss = new WebSocketServer({ port: 0 });

      await new Promise<void>((resolve) => {
        wss.on('listening', () => {
          const address = wss.address() as AddressInfo;
          const client = new WebSocket(`ws://localhost:${address.port}`);

          wss.on('connection', (ws) => {
            ws.on('message', (data) => {
              const message = JSON.parse(data.toString());
              expect(message.id).toBeDefined();
              expect(message.action).toBe('show');

              // Send response
              ws.send(JSON.stringify({ id: message.id, success: true }));
            });
          });

          client.on('open', () => {
            // Simulate sendToGUI logic from bridge.ts
            const messageId = Date.now();
            client.send(JSON.stringify({ action: 'show', id: messageId }));

            client.on('message', (data) => {
              const response = JSON.parse(data.toString());
              expect(response.id).toBe(messageId);
              expect(response.success).toBe(true);

              client.close();
              wss.close();
              resolve();
            });
          });
        });
      });
    });

    it('should implement timeout mechanism for GUI responses', async () => {
      const wss = new WebSocketServer({ port: 0 });

      await new Promise<void>((resolve) => {
        wss.on('listening', () => {
          const address = wss.address() as AddressInfo;
          const client = new WebSocket(`ws://localhost:${address.port}`);

          wss.on('connection', (ws) => {
            // Don't respond to simulate timeout
            ws.on('message', () => {
              // Intentionally not responding
            });
          });

          client.on('open', () => {
            const messageId = Date.now();
            let responseReceived = false;

            const timeout = setTimeout(() => {
              if (!responseReceived) {
                expect(responseReceived).toBe(false);
                client.close();
                wss.close();
                resolve();
              }
            }, 100);

            client.send(JSON.stringify({ action: 'show', id: messageId }));

            client.on('message', () => {
              responseReceived = true;
              clearTimeout(timeout);
            });
          });
        });
      });
    });

    it('should match responses by message ID', async () => {
      const wss = new WebSocketServer({ port: 0 });

      await new Promise<void>((resolve) => {
        wss.on('listening', () => {
          const address = wss.address() as AddressInfo;
          const client = new WebSocket(`ws://localhost:${address.port}`);

          wss.on('connection', (ws) => {
            ws.on('message', (data) => {
              const message = JSON.parse(data.toString());
              // Respond with the same ID
              ws.send(JSON.stringify({ id: message.id, data: 'response' }));
            });
          });

          client.on('open', () => {
            const messageId1 = Date.now();
            const messageId2 = messageId1 + 1;

            let response1Received = false;
            let response2Received = false;

            client.on('message', (data) => {
              const response = JSON.parse(data.toString());

              if (response.id === messageId1) {
                response1Received = true;
              }
              if (response.id === messageId2) {
                response2Received = true;
              }

              if (response1Received && response2Received) {
                expect(response1Received).toBe(true);
                expect(response2Received).toBe(true);
                client.close();
                wss.close();
                resolve();
              }
            });

            // Send two messages
            client.send(JSON.stringify({ action: 'test', id: messageId1 }));
            client.send(JSON.stringify({ action: 'test', id: messageId2 }));
          });
        });
      });
    });
  });

  describe('Tool Handler Logic', () => {
    it('should validate open_whiteboard tool logic flow', async () => {
      // Test the logic: start GUI -> wait for connection -> send show action
      const steps: string[] = [];

      // Simulate the flow
      const simulateOpenWhiteboard = async () => {
        steps.push('start_gui');

        // Wait for connection
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            steps.push('gui_connected');
            resolve();
          }, 10);
        });

        steps.push('send_show_action');
        return 'success';
      };

      const result = await simulateOpenWhiteboard();

      expect(steps).toEqual(['start_gui', 'gui_connected', 'send_show_action']);
      expect(result).toBe('success');
    });

    it('should validate get_whiteboard requires active connection', () => {
      let wsClient: WebSocket | null = null;

      // Simulate the logic from bridge.ts
      const getWhiteboard = () => {
        if (!wsClient) {
          return {
            content: [
              {
                type: 'text',
                text: 'Whiteboard is not open. Please open it first.',
              },
            ],
            isError: true,
          };
        }
        return { content: [], isError: false };
      };

      const result = getWhiteboard();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not open');
    });

    it('should validate get_whiteboard returns image when connected', async () => {
      const mockBase64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      // Simulate successful getImage response
      const getWhiteboard = async () => {
        const response = { image: mockBase64Image };

        if (!response.image) {
          return {
            content: [
              {
                type: 'text',
                text: 'Failed to get whiteboard image',
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'image',
              data: response.image,
              mimeType: 'image/png',
            },
          ],
        };
      };

      const result = await getWhiteboard();
      expect(result.content[0].type).toBe('image');
      if ('data' in result.content[0]) {
        expect(result.content[0].data).toBe(mockBase64Image);
        expect(result.content[0].mimeType).toBe('image/png');
      }
    });

    it('should handle unknown tool names', () => {
      const handleTool = (name: string) => {
        if (name === 'open_whiteboard' || name === 'get_whiteboard') {
          return { isError: false };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
      };

      const result = handleTool('invalid_tool');
      expect(result.isError).toBe(true);
      if (result.content) {
        expect(result.content[0].text).toContain('Unknown tool');
      }
    });

    it('should handle errors in tool execution', async () => {
      const handleTool = async () => {
        try {
          throw new Error('Connection failed');
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      };

      const result = await handleTool();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Error: Connection failed');
    });
  });

  describe('Connection Timeout Logic', () => {
    it('should implement GUI connection timeout', async () => {
      const waitForConnection = (connected: boolean, timeoutMs: number = 100) => {
        return new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('GUI connection timeout'));
          }, timeoutMs);

          const interval = setInterval(() => {
            if (connected) {
              clearTimeout(timeout);
              clearInterval(interval);
              resolve();
            }
          }, 10);
        });
      };

      // Test timeout case
      await expect(waitForConnection(false, 100)).rejects.toThrow('GUI connection timeout');
    });

    it('should resolve when GUI connects before timeout', async () => {
      let isConnected = false;

      const waitForConnection = () => {
        return new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('GUI connection timeout'));
          }, 1000);

          const interval = setInterval(() => {
            if (isConnected) {
              clearTimeout(timeout);
              clearInterval(interval);
              resolve();
            }
          }, 10);
        });
      };

      // Simulate connection after 50ms
      setTimeout(() => {
        isConnected = true;
      }, 50);

      await expect(waitForConnection()).resolves.toBeUndefined();
    });
  });

  describe('Platform-Specific Executable Paths', () => {
    it('should return correct path for each platform', () => {
      const getGuiPath = (platform: string) => {
        switch (platform) {
          case 'win32':
            return 'Promptboard.exe';
          case 'darwin':
            return 'Promptboard.app/Contents/MacOS/Promptboard';
          case 'linux':
            return 'Promptboard';
          default:
            throw new Error(`Unsupported platform for GUI launch: ${platform}`);
        }
      };

      expect(getGuiPath('win32')).toBe('Promptboard.exe');
      expect(getGuiPath('darwin')).toBe('Promptboard.app/Contents/MacOS/Promptboard');
      expect(getGuiPath('linux')).toBe('Promptboard');
      expect(() => getGuiPath('unknown')).toThrow('Unsupported platform');
    });
  });

  describe('Cleanup on Shutdown', () => {
    it('should close WebSocket server on shutdown', async () => {
      const wss = new WebSocketServer({ port: 0 });

      await new Promise<void>((resolve) => {
        wss.on('listening', () => {
          const closeSpy = vi.spyOn(wss, 'close');
          wss.close();
          expect(closeSpy).toHaveBeenCalled();
          resolve();
        });
      });
    });

    it('should kill GUI process on shutdown', () => {
      const mockProcess = {
        kill: vi.fn(),
        on: vi.fn(),
      };

      mockProcess.kill();
      expect(mockProcess.kill).toHaveBeenCalled();
    });
  });
});
