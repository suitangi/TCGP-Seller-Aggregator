#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const BROWSERS = ['chrome', 'firefox'];
const DIST_DIR = 'dist';

// Clean dist directory
function clean() {
  console.log('Cleaning dist directory...');
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  console.log('✓ Clean complete');
}

// Copy file
function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

// Copy directory recursively
function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const files = fs.readdirSync(src);
  
  for (const file of files) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    const stat = fs.statSync(srcPath);
    
    if (stat.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

// Create zip file
async function createZip(sourceDir, zipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      console.log(`  ✓ Created ${zipPath} (${archive.pointer()} bytes)`);
      resolve();
    });
    
    archive.on('error', (err) => {
      reject(err);
    });
    
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

// Build for specific browser
async function build(browser) {
  console.log(`\nBuilding for ${browser}...`);
  
  const browserDistDir = path.join(DIST_DIR, browser);
  const browserSrcDir = browser;
  
  // Create unpacked build
  console.log(`  Creating unpacked build at ${browserDistDir}/`);
  copyDirectory(browserSrcDir, browserDistDir);
  
  // Create zip file
  const zipPath = path.join(DIST_DIR, `${browser}.zip`);
  await createZip(browserDistDir, zipPath);
  
  console.log(`✓ ${browser} build complete`);
}

// Main build function
async function main() {
  const args = process.argv.slice(2);
  
  if (args[0] === 'clean') {
    clean();
    return;
  }
  
  if (args.length === 0 || args[0] === 'all') {
    clean();
    for (const browser of BROWSERS) {
      await build(browser);
    }
    console.log('\n✓ All builds complete!');
  } else {
    const browser = args[0];
    if (BROWSERS.includes(browser)) {
      await build(browser);
      console.log('\n✓ Build complete!');
    } else {
      console.error(`Unknown browser: ${browser}. Use chrome or firefox.`);
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});