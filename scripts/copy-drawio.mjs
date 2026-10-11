#!/usr/bin/env node
// Copies the draw.io build (softalink/drawio, src/main/webapp after `ant app`)
// into the two plugins:
//   panel/dist/drawio/       the HMI runtime only (js/hmi-viewer.min.js and
//                            its lazy libraries) and the demo template
//   editor-app/dist/editor/  the draw.io editor with the HMI plugin
//
// Usage: node scripts/copy-drawio.mjs <path to drawio/src/main/webapp>
//        (or set DRAWIO_WEBAPP)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webapp = path.resolve(process.argv[2] || process.env.DRAWIO_WEBAPP || path.join(root, '..', 'drawio/src/main/webapp'));

function need(file) {
  if (!fs.existsSync(path.join(webapp, file))) {
    console.error(`Missing ${file} in ${webapp}. Build drawio first (cd etc/build && ant app).`);
    process.exit(1);
  }
}

need('js/hmi-viewer.min.js');
need('js/app.min.js');
need('plugins/hmi.min.js');

function copy(from, to, filter) {
  fs.cpSync(path.join(webapp, from), to, { recursive: true, filter: filter || (() => true) });
}

// Panel: runtime only
const panel = path.join(root, 'panel/dist/drawio');
fs.rmSync(panel, { recursive: true, force: true });
copy('js/hmi-viewer.min.js', path.join(panel, 'js/hmi-viewer.min.js'));
copy('plugins/hmi/lib', path.join(panel, 'plugins/hmi/lib'));
copy('plugins/hmi/NOTICE', path.join(panel, 'plugins/hmi/NOTICE'));
copy('templates/hmi/intouch_links_demo.xml', path.join(panel, 'templates/intouch_links_demo.xml'));

// Editor: the app without development sources, integrations, the service
// worker and server-side files
const SKIP = new Set([
  'WEB-INF',
  'META-INF',
  'connect',
  'service-worker.js',
  'service-worker.js.map',
  'js/diagramly',
  'js/grapheditor',
  'js/integrate.min.js',
  'js/embed.dev.js',
  'js/desktop',
]);
const KEEP_HTML = new Set(['index.html', 'clear.html', 'hmi-run.html']);
const editor = path.join(root, 'editor-app/dist/editor');
fs.rmSync(editor, { recursive: true, force: true });
fs.cpSync(webapp, editor, {
  recursive: true,
  filter: (src) => {
    const rel = path.relative(webapp, src).split(path.sep).join('/');

    if (rel === '') {
      return true;
    }

    if (SKIP.has(rel) || /^workbox-.*\.js(\.map)?$/.test(rel)) {
      return false;
    }

    // Top-level pages other than the editor and the Run Screen
    if (!rel.includes('/') && rel.endsWith('.html') && !KEEP_HTML.has(rel)) {
      return false;
    }

    return true;
  },
});

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
