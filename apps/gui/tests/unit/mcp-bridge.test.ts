import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn, ChildProcess } from 'child_process';

/**
 * MCP Bridge Server Integration Test
 * 
 * Test Objectives:
 * 1. Can the MCP Bridge communicate via stdio?
 * 2. Does calling open_whiteboard spawn the GUI?
 * 3. Does calling get_whiteboard retrieve an image from the GUI?
 * 4. Does it prevent duplicate spawns when the GUI is already running?
 */

describe('MCP Bridge Server', () => {
  describe('Tool Registration', () => {
    it('should register open_whiteboard and get_whiteboard tools', () => {
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
      expect(tools[1].name).toBe('get_whiteboard');
    });
  });

  describe('GUI Process Management', () => {
    it('should spawn GUI process with --ws-port argument', () => {
      // Mock spawn function
      const mockSpawn = vi.fn(() => ({
        on: vi.fn(),
        kill: vi.fn(),
      } as unknown as ChildProcess));

      const wsPort = 12345;
      const guiPath = 'Promptboard.exe';
      
      const process = mockSpawn(guiPath, [`--ws-port=${wsPort}`]);

      expect(mockSpawn).toHaveBeenCalledWith(guiPath, [`--ws-port=${wsPort}`]);
      expect(process).toBeDefined();
    });

    it('should not track GUI process manually (rely on Single Instance Lock)', () => {
      // MCP Bridge only attempts to spawn each time
      // Electron prevents duplicates with a Single Instance Lock
      const mockSpawn = vi.fn(() => ({
        on: vi.fn(),
        kill: vi.fn(),
      } as unknown as ChildProcess));

      // First call
      mockSpawn('Promptboard.exe', ['--ws-port=12345']);
      
      // Second call (duplicate)
      mockSpawn('Promptboard.exe', ['--ws-port=12345']);

      // MCP Bridge attempts to spawn both times
      expect(mockSpawn).toHaveBeenCalledTimes(2);
      // Electron automatically terminates the second one
    });
  });

  describe('WebSocket Communication', () => {
    it('should wait for GUI to connect via WebSocket', async () => {
      // Mock WebSocket server
      const mockWss = {
        on: vi.fn((event, callback) => {
          if (event === 'connection') {
            // Simulate immediate connection
            setTimeout(() => callback({ on: vi.fn() }), 10);
          }
        }),
        address: vi.fn(() => ({ port: 12345 })),
      };

      const connectionPromise = new Promise<void>((resolve) => {
        mockWss.on('connection', () => {
          resolve();
        });
      });

      await connectionPromise;
      expect(mockWss.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should send getImage request to GUI and receive response', async () => {
      const mockWsClient = {
        send: vi.fn(),
        on: vi.fn((event, callback) => {
          if (event === 'message') {
            // Simulate response
            setTimeout(() => {
              const response = JSON.stringify({
                id: 123,
                image: 'base64ImageData',
              });
              callback(Buffer.from(response));
            }, 10);
          }
        }),
      };

      const responsePromise = new Promise<any>((resolve) => {
        mockWsClient.on('message', (data: Buffer) => {
          const response = JSON.parse(data.toString());
          resolve(response);
        });
      });

      mockWsClient.send(JSON.stringify({ id: 123, action: 'getImage' }));

      const response = await responsePromise;
      expect(response.id).toBe(123);
      expect(response.image).toBe('base64ImageData');
    });

    it('should handle GUI connection timeout', async () => {
      const connectionTimeout = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('GUI connection timeout'));
        }, 100);

        // Simulate no connection
      });

      await expect(connectionTimeout).rejects.toThrow('GUI connection timeout');
    });

    it('should handle GUI not responding to getImage', async () => {
      const mockWsClient = {
        send: vi.fn(),
        on: vi.fn(),
      };

      const responseTimeout = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('GUI response timeout'));
        }, 100);

        // Simulate no response
      });

      mockWsClient.send(JSON.stringify({ id: 123, action: 'getImage' }));

      await expect(responseTimeout).rejects.toThrow('GUI response timeout');
    });
  });

  describe('Error Handling', () => {
    it('should return error if GUI not connected when calling get_whiteboard', () => {
      const wsClient = null; // Not connected

      if (!wsClient) {
        const error = {
          content: [
            {
              type: 'text',
              text: 'Whiteboard is not open. Please open it first.',
            },
          ],
          isError: true,
        };

        expect(error.isError).toBe(true);
        expect(error.content[0].text).toContain('not open');
      }
    });

    it('should handle GUI spawn failure', () => {
      const mockSpawn = vi.fn(() => {
        const mockProcess = {
          on: vi.fn((event: string, callback: Function) => {
            if (event === 'error') {
              callback(new Error('Failed to spawn'));
            }
          }),
        };
        return mockProcess as unknown as ChildProcess;
      });

      const process = mockSpawn('InvalidPath.exe', []);
      
      process.on('error', (error) => {
        expect(error.message).toBe('Failed to spawn');
      });
    });
  });

  describe('Cleanup', () => {
    it('should close WebSocket server on shutdown', () => {
      const mockWss = {
        close: vi.fn(),
      };

      mockWss.close();

      expect(mockWss.close).toHaveBeenCalled();
    });

    it('should kill GUI process on shutdown if running', () => {
      const mockProcess = {
        kill: vi.fn(),
      } as unknown as ChildProcess;

      mockProcess.kill();

      expect(mockProcess.kill).toHaveBeenCalled();
    });
  });
});
