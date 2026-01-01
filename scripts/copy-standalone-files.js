const fs = require('fs');
const path = require('path');

const standaloneDir = path.join(__dirname, '..', '.next', 'standalone');
const projectRoot = path.join(__dirname, '..');

// Find the actual standalone directory (might be nested)
function findStandaloneServerDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isFile() && entry.name === 'server.js') {
      return dir;
    }
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      const nestedPath = path.join(dir, entry.name);
      const found = findStandaloneServerDir(nestedPath);
      if (found) return found;
    }
  }
  
  return null;
}

const serverDir = findStandaloneServerDir(standaloneDir);

if (!serverDir) {
  console.error('Could not find server.js in standalone directory');
  process.exit(1);
}

console.log(`Found standalone server at: ${serverDir}`);

// Copy public folder
const publicSrc = path.join(projectRoot, 'public');
const publicDest = path.join(serverDir, 'public');

if (fs.existsSync(publicSrc)) {
  console.log('Copying public folder...');
  if (fs.existsSync(publicDest)) {
    fs.rmSync(publicDest, { recursive: true, force: true });
  }
  fs.cpSync(publicSrc, publicDest, { recursive: true });
  console.log('✓ Public folder copied');
} else {
  console.warn('Public folder not found, skipping...');
}

// Copy .next/static folder
const staticSrc = path.join(projectRoot, '.next', 'static');
const staticDest = path.join(serverDir, '.next', 'static');

if (fs.existsSync(staticSrc)) {
  console.log('Copying .next/static folder...');
  // Ensure .next directory exists
  const nextDir = path.join(serverDir, '.next');
  if (!fs.existsSync(nextDir)) {
    fs.mkdirSync(nextDir, { recursive: true });
  }
  
  if (fs.existsSync(staticDest)) {
    fs.rmSync(staticDest, { recursive: true, force: true });
  }
  fs.cpSync(staticSrc, staticDest, { recursive: true });
  console.log('✓ .next/static folder copied');
} else {
  console.warn('.next/static folder not found, skipping...');
}

console.log('\n✓ Standalone build files copied successfully!');
console.log(`\nTo run the server, navigate to:`);
console.log(`  cd ${serverDir}`);
console.log(`  node server.js`);

