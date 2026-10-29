// Rebuilds vendor/three-<ver>.min.js: an IIFE (global THREE) of three.js core plus the addons the game uses.
//   node games/fishing/tools/vendor/build-three.mjs
// Installs the pinned packages from npm into a temp folder and bundles with esbuild. three.js is MIT
// (vendor/three-LICENSE.txt); esbuild is only a build tool and is not shipped.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const THREE = '0.180.0', ESBUILD = '0.25.10';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../vendor', `three-${THREE}.min.js`);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'three-vendor-'));
execSync(`npm init -y && npm install three@${THREE} esbuild@${ESBUILD}`, { cwd: tmp, stdio: 'inherit' });
fs.copyFileSync(path.join(HERE, 'three-entry.mjs'), path.join(tmp, 'entry.mjs'));
execSync(`node node_modules/esbuild/bin/esbuild entry.mjs --bundle --format=iife --global-name=THREE --minify --legal-comments=none --outfile=out.js`, { cwd: tmp, stdio: 'inherit' });
const banner = `/* three.js r${THREE.split('.')[1]} (${THREE}) — MIT License, Copyright © 2010-2025 three.js authors (see three-LICENSE.txt). Bundled by tools/vendor/build-three.mjs */\n`;
fs.writeFileSync(OUT, banner + fs.readFileSync(path.join(tmp, 'out.js'), 'utf8'));
fs.copyFileSync(path.join(tmp, 'node_modules/three/LICENSE'), path.resolve(HERE, '../../vendor/three-LICENSE.txt'));
console.log('wrote', OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB');
fs.rmSync(tmp, { recursive: true, force: true });
