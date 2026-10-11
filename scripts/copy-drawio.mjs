#!/usr/bin/env node
// Copies the vendored draw.io build (vendor/drawio) into the two plugins:
//   panel/dist/drawio/       the HMI runtime only (js/hmi-viewer.min.js and
//                            its lazy libraries) and the demo template
//   editor-app/dist/editor/  the draw.io editor with the HMI plugin
//
// Usage: node scripts/copy-drawio.mjs [source]
//   source defaults to vendor/drawio; scripts/update-drawio.mjs refreshes it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.argv[2] || path.join(root, 'vendor/drawio'));

for (const file of ['js/hmi-viewer.min.js', 'js/app.min.js', 'plugins/hmi.min.js', 'templates/hmi/intouch_links_demo.xml']) {
  if (!fs.existsSync(path.join(source, file))) {
    console.error(`Missing ${file} in ${source}`);
    process.exit(1);
  }
}

function copy(from, to) {
  fs.cpSync(path.join(source, from), to, { recursive: true });
}

// Panel: runtime only
const panel = path.join(root, 'panel/dist/drawio');
fs.rmSync(panel, { recursive: true, force: true });
copy('js/hmi-viewer.min.js', path.join(panel, 'js/hmi-viewer.min.js'));
copy('plugins/hmi/lib', path.join(panel, 'plugins/hmi/lib'));
copy('plugins/hmi/NOTICE', path.join(panel, 'plugins/hmi/NOTICE'));
copy('templates/hmi/intouch_links_demo.xml', path.join(panel, 'templates/intouch_links_demo.xml'));

if (fs.existsSync(path.join(source, 'VERSION.json'))) {
  copy('VERSION.json', path.join(panel, 'VERSION.json'));
}

// Editor: the whole vendored tree
const editor = path.join(root, 'editor-app/dist/editor');
fs.rmSync(editor, { recursive: true, force: true });
fs.cpSync(source, editor, { recursive: true });

function size(dir) {
  let total = 0;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    total += entry.isDirectory() ? size(p) : fs.statSync(p).size;
  }

  return total;
}

const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
console.log(`panel/dist/drawio       ${mb(size(panel))}`);
console.log(`editor-app/dist/editor  ${mb(size(editor))}`);
