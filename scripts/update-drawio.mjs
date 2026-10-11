#!/usr/bin/env node
// Refreshes vendor/drawio from a draw.io build (softalink/drawio,
// src/main/webapp after `cd etc/build && ant app`). This is the only step
// that needs the drawio repository; building the plugins uses vendor/drawio.
//
// Usage: node scripts/update-drawio.mjs <path to drawio/src/main/webapp>
//        (or set DRAWIO_WEBAPP)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv[2] || process.env.DRAWIO_WEBAPP;

if (!arg) {
  console.error('Usage: node scripts/update-drawio.mjs <path to drawio/src/main/webapp>');
  process.exit(1);
}

const webapp = path.resolve(arg);

for (const file of ['js/app.min.js', 'js/hmi-viewer.min.js', 'plugins/hmi.min.js', 'templates/hmi/intouch_links_demo.xml']) {
  if (!fs.existsSync(path.join(webapp, file))) {
    console.error(`Missing ${file} in ${webapp}. Build drawio first (cd etc/build && ant app).`);
    process.exit(1);
  }
}

// Not needed by the editor in embed mode or by the runtime: development
// sources, integrations, cloud and desktop code, the service worker,
// server-side files and the other viewer bundles
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
  'js/viewer.min.js',
  'js/viewer-static.min.js',
]);
const KEEP_HTML = new Set(['index.html', 'clear.html', 'hmi-run.html']);

const vendor = path.join(root, 'vendor/drawio');
fs.rmSync(vendor, { recursive: true, force: true });
fs.cpSync(webapp, vendor, {
  recursive: true,
  filter: (src) => {
    const rel = path.relative(webapp, src).split(path.sep).join('/');

    if (rel === '') {
      return true;
    }

    if (SKIP.has(rel) || /^workbox-.*\.js(\.map)?$/.test(rel) || rel.endsWith('.map')) {
      return false;
    }

    // Top-level pages other than the editor and the Run Screen
    if (!rel.includes('/') && rel.endsWith('.html') && !KEEP_HTML.has(rel)) {
      return false;
    }

    return true;
  },
});

// Where the files came from
function git(...args) {
  try {
    return execFileSync('git', ['-C', webapp, ...args], { encoding: 'utf8' }).trim();
  } catch (e) {
    return 'unknown';
  }
}

const dirty = git('status', '--porcelain', '--', '.') !== '';
const version = {
  repository: git('remote', 'get-url', 'origin').replace(/^https?:\/\/[^@/]*@/, 'https://').replace(/\/\/[^/]*\/git\//, '//github.com/'),
  branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
  commit: git('rev-parse', 'HEAD') + (dirty ? ' (with uncommitted changes)' : ''),
  date: git('log', '-1', '--format=%cs'),
  updated: new Date().toISOString().slice(0, 10),
};
fs.writeFileSync(path.join(vendor, 'VERSION.json'), JSON.stringify(version, null, 2) + '\n');

function size(dir) {
  let total = 0;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    total += entry.isDirectory() ? size(p) : fs.statSync(p).size;
  }

  return total;
}

console.log(`vendor/drawio ${(size(vendor) / 1048576).toFixed(1)} MB from ${version.branch} ${version.commit}`);
