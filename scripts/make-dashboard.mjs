#!/usr/bin/env node
// Generates provisioning/dashboards/hmi.json: a tank screen fed by TestData
// queries (used by the end-to-end tests) and the InTouch demo template.
//
// Usage: node scripts/make-dashboard.mjs [path to drawio/src/main/webapp]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webapp = path.resolve(process.argv[2] || process.env.DRAWIO_WEBAPP || path.join(root, '..', 'drawio/src/main/webapp'));
const demo = fs.readFileSync(path.join(webapp, 'templates/hmi/intouch_links_demo.xml'), 'utf8').trim();

const attr = (obj) =>
  JSON.stringify(obj).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function cell(id, label, style, x, y, w, h, links) {
  return (
    `<object id="${id}" label="${esc(label)}"${links ? ` hmiLinks="${attr(links)}"` : ''}>` +
    `<mxCell style="${esc(style)}" vertex="1" parent="1">` +
    `<mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell></object>`
  );
}

const config = {
  version: 1,
  sim: 'off',
  sources: [{ id: 'grafana', name: 'Grafana', type: 'host', enabled: true }],
  tags: [
    { name: 'Level', type: 'number', access: 'r', min: 0, max: 100, decimals: 1 },
    { name: 'Pump', type: 'number', access: 'r' },
    { name: 'SetPoint', type: 'number', access: 'rw', min: 0, max: 100, initial: 50,
      write: { source: 'grafana', mode: 'optimistic' } },
  ],
  triggers: [],
  runtime: { width: 600, height: 300 },
};
const label = 'rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#90A4AE;fontSize=14;';
const button = 'rounded=1;whiteSpace=wrap;html=1;fillColor=#1E88E5;strokeColor=#1565C0;fontColor=#FFFFFF;fontStyle=1;';
const tankXml =
  '<mxfile><diagram id="tank" name="Tank"><mxGraphModel grid="1" gridSize="10" page="1" pageWidth="600" pageHeight="300"><root>' +
  `<object id="0" hmi="${attr(config)}"><mxCell/></object><mxCell id="1" parent="0"/>` +
  cell('title', 'Site: ${site}', 'text;html=1;fontSize=18;fontStyle=1;align=left;', 20, 10, 400, 30) +
  cell('tank', '', 'shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;size=8;fillColor=#42A5F5;strokeColor=#1565C0;', 40, 60, 100, 200, {
    fillVertical: { expr: 'Level', valueAtMin: 0, valueAtMax: 100, minPercent: 0, maxPercent: 100, direction: 'up', backgroundColor: '#ECEFF1' },
  }) +
  cell('level', 'Level = ##.# %', label, 180, 60, 180, 40, { valueAnalog: { expr: 'Level', format: { mode: 'text' } } }) +
  cell('pump', 'PUMP', 'ellipse;whiteSpace=wrap;html=1;fillColor=#9E9E9E;strokeColor=#424242;fontColor=#FFFFFF;fontStyle=1;', 180, 120, 80, 80, {
    fillColor: { kind: 'discrete', expr: 'Pump', offColor: '#9E9E9E', onColor: '#43A047' },
  }) +
  cell('setpoint', 'SP = ###', label, 380, 60, 180, 40, { valueAnalog: { expr: 'SetPoint', format: { mode: 'text' } } }) +
  cell('sp-up', 'SP + 5', button, 380, 120, 180, 40, { pushValue: { tag: 'SetPoint', action: 'add', value: 5, min: 0, max: 100 } }) +
  '</root></mxGraphModel></diagram></mxfile>';

const testdata = { type: 'grafana-testdata-datasource', uid: 'trlxrdZVk' };
const defaults = { fit: 'page', sim: 'diagram', applyVariables: true, tagMapping: '', writeMode: 'off', writeUrl: '',
  writeMinRole: 'Editor', editorUrl: 'public/plugins/softalink-hmieditor-app/editor/index.html' };

const dashboard = {
  uid: 'hmi-demo',
  title: 'HMI demo',
  editable: true,
  schemaVersion: 41,
  time: { from: 'now-5m', to: 'now' },
  refresh: '',
  templating: {
    list: [{ name: 'site', label: 'Site', type: 'custom', query: 'Plant-1,Plant-2',
      current: { text: 'Plant-1', value: 'Plant-1' },
      options: [{ text: 'Plant-1', value: 'Plant-1', selected: true }, { text: 'Plant-2', value: 'Plant-2', selected: false }] }],
  },
  panels: [
    {
      id: 1,
      type: 'softalink-hmi-panel',
      title: 'Tank (TestData)',
      gridPos: { h: 12, w: 12, x: 0, y: 0 },
      datasource: testdata,
      targets: [
        { refId: 'A', datasource: testdata, scenarioId: 'csv_metric_values', stringInput: '10,20,30,42.5', alias: 'Level' },
        { refId: 'B', datasource: testdata, scenarioId: 'csv_metric_values', stringInput: '0,1', alias: 'Pump' },
      ],
      options: { ...defaults, diagram: tankXml, writeMode: 'http', writeUrl: '/api/hmi-test/write?site=${site}' },
    },
    {
      id: 2,
      type: 'softalink-hmi-panel',
      title: 'InTouch demo (simulated)',
      gridPos: { h: 12, w: 12, x: 12, y: 0 },
      datasource: testdata,
      targets: [{ refId: 'A', datasource: testdata, scenarioId: 'random_walk', alias: 'Unused' }],
      options: { ...defaults, diagram: demo, sim: 'only' },
    },
  ],
};

fs.mkdirSync(path.join(root, 'provisioning/dashboards'), { recursive: true });
fs.writeFileSync(path.join(root, 'provisioning/dashboards/hmi.json'), JSON.stringify(dashboard, null, 2) + '\n');
console.log('Wrote provisioning/dashboards/hmi.json');
