import { FieldType, toDataFrame } from '@grafana/data';
import { framesToValues, hasMinRole, hmiRoles, parseMapping, resolveUrl } from './bridge';

describe('parseMapping', () => {
  it('reads "grafana name = tag name" lines and skips comments and blanks', () => {
    const m = parseMapping('# comment\nTemp A = Tank1.Temp\n\n  Run=Pump1.Run  \nbroken line\n= x');
    expect(Array.from(m.entries())).toEqual([
      ['Temp A', 'Tank1.Temp'],
      ['Run', 'Pump1.Run'],
    ]);
  });
});

describe('framesToValues', () => {
  const frame = toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
      { name: 'Level', type: FieldType.number, values: [10, 42.5, null], config: { unit: 'percent' } },
      { name: 'Run', type: FieldType.boolean, values: [true, false, true] },
      { name: 'Mode', type: FieldType.string, values: ['AUTO', 'MAN', 'OFF'] },
    ],
  });

  it('takes the last non-null value of each field with its time', () => {
    const { values } = framesToValues([frame], new Map());
    expect(values).toEqual([
      { tag: 'Level', value: 42.5, ts: 2000 },
      { tag: 'Run', value: true, ts: 3000 },
      { tag: 'Mode', value: 'OFF', ts: 3000 },
    ]);
  });

  it('lists the tags with their types and units', () => {
    const { tags } = framesToValues([frame], new Map());
    expect(tags).toEqual([
      { name: 'Level', type: 'number', unit: 'percent' },
      { name: 'Run', type: 'boolean' },
      { name: 'Mode', type: 'string' },
    ]);
  });

  it('renames fields with the mapping', () => {
    const { values } = framesToValues([frame], parseMapping('Level = Tank1.Level'));
    expect(values.map((v) => v.tag)).toEqual(['Tank1.Level', 'Run', 'Mode']);
  });

  it('uses the display name, so a query alias names the tag', () => {
    const aliased = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1] },
        { name: 'Value', type: FieldType.number, values: [7], config: { displayNameFromDS: 'Pump1.Speed' } },
      ],
    });
    expect(framesToValues([aliased], new Map()).values).toEqual([{ tag: 'Pump1.Speed', value: 7, ts: 1 }]);
  });

  it('handles frames without time and no data', () => {
    const plain = toDataFrame({ fields: [{ name: 'x', type: FieldType.number, values: [1, 2] }] });
    expect(framesToValues([plain], new Map()).values).toEqual([{ tag: 'x', value: 2 }]);
    expect(framesToValues(undefined, new Map())).toEqual({ values: [], tags: [] });
  });
});

describe('roles', () => {
  it('compares Grafana org roles', () => {
    expect(hasMinRole('Editor', 'Editor')).toBe(true);
    expect(hasMinRole('Admin', 'Editor')).toBe(true);
    expect(hasMinRole('Viewer', 'Editor')).toBe(false);
    expect(hasMinRole('None', 'Viewer')).toBe(false);
    expect(hasMinRole(undefined, 'Viewer')).toBe(false);
  });

  it('gives cumulative HMI roles', () => {
    expect(hmiRoles('Viewer')).toEqual(['viewer']);
    expect(hmiRoles('Editor')).toEqual(['viewer', 'editor']);
    expect(hmiRoles('Admin')).toEqual(['viewer', 'editor', 'admin']);
    expect(hmiRoles('None')).toEqual([]);
  });
});

describe('resolveUrl', () => {
  it('keeps absolute URLs and prefixes the sub path', () => {
    expect(resolveUrl('/grafana', 'public/plugins/x/')).toBe('/grafana/public/plugins/x/');
    expect(resolveUrl('/grafana/', '/api/write')).toBe('/grafana/api/write');
    expect(resolveUrl('', 'public/x')).toBe('/public/x');
    expect(resolveUrl('/grafana', 'https://example.com/editor')).toBe('https://example.com/editor');
  });
});
