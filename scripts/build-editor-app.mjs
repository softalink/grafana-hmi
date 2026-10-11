#!/usr/bin/env node
// Builds editor-app/dist from editor-app/src: plugin.json (with version and
// date), module.js and the logo. The editor files are added by
// scripts/copy-drawio.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'editor-app/src');
const dist = path.join(root, 'editor-app/dist');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const today = new Date().toISOString().slice(0, 10);

fs.mkdirSync(dist, { recursive: true });

for (const name of ['module.js', 'img']) {
  fs.cpSync(path.join(src, name), path.join(dist, name), { recursive: true });
}

const pluginJson = fs
  .readFileSync(path.join(src, 'plugin.json'), 'utf8')
  .replace('%VERSION%', version)
  .replace('%TODAY%', today);
fs.writeFileSync(path.join(dist, 'plugin.json'), pluginJson);

for (const name of ['README.md', 'LICENSE']) {
  const file = fs.existsSync(path.join(root, 'editor-app', name)) ? path.join(root, 'editor-app', name) : path.join(root, name);

  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join(dist, name));
  }
}

console.log(`editor-app/dist ${version}`);
