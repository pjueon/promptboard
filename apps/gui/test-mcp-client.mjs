/**
 * Simple MCP Client for testing
 */
import { spawn } from 'child_process';

const mcpServer = spawn('node', ['mcp-bridge.cjs'], {
  cwd: 'C:\\Users\\jueon\\Desktop\\PromptBoard\\apps\\gui\\release\\win-unpacked',
  stdio: ['pipe', 'pipe', 'inherit'],
});

let messageId = 1;

// Send message to server
function sendMessage(method, params = {}) {
  const message = {
    jsonrpc: '2.0',
    id: messageId++,
    method,
    params,
  };
  
  const msgStr = JSON.stringify(message) + '\n';
  console.log('📤 Sending:', msgStr.trim());
  mcpServer.stdin.write(msgStr);
}

// Receive messages from server
let buffer = '';
mcpServer.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  lines.forEach(line => {
    if (line.trim()) {
      console.log('📥 Received:', line);
      try {
        const response = JSON.parse(line);
        console.log('✅ Parsed:', JSON.stringify(response, null, 2));
      } catch (e) {
        console.log('⚠️  Not JSON:', line);
      }
    }
  });
});

mcpServer.on('error', (error) => {
  console.error('❌ Server error:', error);
});

mcpServer.on('close', (code) => {
  console.log(`\n🛑 Server closed with code ${code}`);
  process.exit(code || 0);
});

// Initialize
console.log('🚀 Sending initialize...\n');
sendMessage('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: {
    name: 'test-client',
    version: '1.0.0',
  },
});

// List tools after 2 seconds
setTimeout(() => {
  console.log('\n📨 Sending tools/list...\n');
  sendMessage('tools/list');
}, 2000);

// Exit after 5 seconds
setTimeout(() => {
  console.log('\n⏱️  Test complete, exiting...');
  mcpServer.kill();
}, 5000);
