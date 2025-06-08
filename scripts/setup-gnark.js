#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ASSETS_BIN_DIR = path.join(__dirname, '..', 'src', 'assets', 'bin');
const IOS_DIR = path.join(__dirname, '..', 'ios');
const ANDROID_JNI_DIR = path.join(
  __dirname,
  '..',
  'android',
  'src',
  'main',
  'jniLibs'
);

// Ensure directories exist
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Copy iOS libraries
function copyIOSLibraries() {
  console.log('Setting up iOS gnark libraries...');

  const iosLibs = ['darwin-arm64-libprove.so', 'darwin-arm64-libverify.so'];

  iosLibs.forEach((lib) => {
    const src = path.join(ASSETS_BIN_DIR, lib);
    const dest = path.join(IOS_DIR, lib);

    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`✓ Copied ${lib} to iOS directory`);
    } else {
      console.warn(`⚠ ${lib} not found in assets/bin`);
    }
  });
}

// Copy Android libraries
function copyAndroidLibraries() {
  console.log('\nSetting up Android gnark libraries...');

  // Create architecture directories
  const arm64Dir = path.join(ANDROID_JNI_DIR, 'arm64-v8a');
  const x86_64Dir = path.join(ANDROID_JNI_DIR, 'x86_64');

  ensureDir(arm64Dir);
  ensureDir(x86_64Dir);

  // Copy ARM64 libraries
  const arm64Libs = [
    { src: 'linux-arm64-libprove.so', dest: 'liblinux-arm64-libprove.so' },
    { src: 'linux-arm64-libverify.so', dest: 'liblinux-arm64-libverify.so' },
  ];

  arm64Libs.forEach(({ src, dest }) => {
    const srcPath = path.join(ASSETS_BIN_DIR, src);
    const destPath = path.join(arm64Dir, dest);

    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✓ Copied ${src} to arm64-v8a as ${dest}`);
    } else {
      console.warn(`⚠ ${src} not found in assets/bin`);
    }
  });

  // Copy x86_64 libraries
  const x86_64Libs = [
    { src: 'linux-x86_64-libprove.so', dest: 'liblinux-x86_64-libprove.so' },
    { src: 'linux-x86_64-libverify.so', dest: 'liblinux-x86_64-libverify.so' },
  ];

  x86_64Libs.forEach(({ src, dest }) => {
    const srcPath = path.join(ASSETS_BIN_DIR, src);
    const destPath = path.join(x86_64Dir, dest);

    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✓ Copied ${src} to x86_64 as ${dest}`);
    } else {
      console.warn(`⚠ ${src} not found in assets/bin`);
    }
  });
}

// Main execution
console.log('Setting up gnark libraries for iOS and Android...\n');

copyIOSLibraries();
copyAndroidLibraries();

console.log('\n✅ Gnark setup complete!');
console.log('\nNext steps:');
console.log('1. For iOS: Run "cd ios && pod install"');
console.log('2. For Android: Rebuild the project');
console.log('3. Make sure to use prover="reclaim_gnark" in your Zkp2pProvider');
