#!/usr/bin/env node

/**
 * Post-install script to download platform-specific PromptBoard binary
 * from GitHub Releases
 */

import { createWriteStream } from 'fs';
import { mkdir, chmod, access } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_OWNER = 'pjueon';
const REPO_NAME = 'promptboard';
const BINARIES_DIR = join(__dirname, '..', 'binaries');

// Platform mapping
const PLATFORM_MAP = {
  win32: { name: 'Windows', ext: '.zip' },
  darwin: { name: 'macOS', ext: '.zip' },
  linux: { name: 'Linux', ext: '.zip' }
};

/**
 * Get the latest release info from GitHub
 */
async function getLatestRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
      headers: {
        'User-Agent': 'promptboard-installer'
      }
    };

    https.get(options, (res) => {
      let data = '';

      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Failed to fetch release info: ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Download file from URL
 */
async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'promptboard-installer' }
    }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // Follow redirect
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: ${res.statusCode}`));
        return;
      }

      const fileStream = createWriteStream(destPath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Extract zip file (cross-platform)
 */
async function extractZip(zipPath, destDir) {
  const AdmZip = (await import('adm-zip')).default;
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(destDir, true);
}

/**
 * Main installation logic
 */
async function install() {
  try {
    console.log('📦 Installing PromptBoard binary...');

    // Detect platform
    const platform = process.platform;
    const platformInfo = PLATFORM_MAP[platform];

    if (!platformInfo) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    console.log(`🖥️  Platform: ${platformInfo.name}`);

    // Get latest release
    console.log('🔍 Fetching latest release...');
    const release = await getLatestRelease();
    const version = release.tag_name;
    console.log(`📌 Version: ${version}`);

    // Find the correct asset
    const assetName = `PromptBoard-${version}-${platform === 'darwin' ? 'mac' : platform === 'win32' ? 'win' : 'linux'}.zip`;
    const asset = release.assets.find(a => a.name === assetName);

    if (!asset) {
      console.warn(`⚠️  No binary found for ${platformInfo.name}`);
      console.warn(`   Available assets: ${release.assets.map(a => a.name).join(', ')}`);
      console.warn(`   PromptBoard will work in MCP server mode only.`);
      return;
    }

    // Create binaries directory
    await mkdir(BINARIES_DIR, { recursive: true });

    // Download binary
    const zipPath = join(BINARIES_DIR, assetName);
    console.log(`⬇️  Downloading ${asset.name}...`);
    await downloadFile(asset.browser_download_url, zipPath);

    // Extract
    console.log('📂 Extracting...');
    await extractZip(zipPath, BINARIES_DIR);

    // Set executable permissions on Unix-like systems
    if (platform !== 'win32') {
      const appName = platform === 'darwin' ? 'PromptBoard.app' : 'PromptBoard';
      const execPath = platform === 'darwin' 
        ? join(BINARIES_DIR, appName, 'Contents', 'MacOS', 'PromptBoard')
        : join(BINARIES_DIR, appName);
      
      try {
        await access(execPath);
        await chmod(execPath, 0o755);
        console.log('✅ Set executable permissions');
      } catch (err) {
        console.warn('⚠️  Could not set executable permissions:', err.message);
      }
    }

    // Clean up zip file
    const { unlink } = await import('fs/promises');
    await unlink(zipPath);

    console.log('✅ Installation complete!');
    console.log(`\n📍 Binary location: ${BINARIES_DIR}`);
    console.log('\n🚀 Usage:');
    console.log('   npx promptboard');
    console.log('\n   Or add to your MCP settings:');
    console.log('   {');
    console.log('     "mcpServers": {');
    console.log('       "promptboard": {');
    console.log('         "command": "npx",');
    console.log('         "args": ["-y", "promptboard"]');
    console.log('       }');
    console.log('     }');
    console.log('   }');

  } catch (error) {
    console.error('❌ Installation failed:', error.message);
    console.error('\n   You can manually download the binary from:');
    console.error(`   https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`);
    console.error('\n   PromptBoard will still work as an MCP server.');
    process.exit(0); // Don't fail npm install
  }
}

// Run installation
install();
