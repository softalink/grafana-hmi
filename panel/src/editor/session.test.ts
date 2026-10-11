import { framingAllowed } from './embedding';
import { EditorSession, editorParams } from './session';

const ORIGIN = 'http://grafana.local';

function setup() {
  const posted: any[] = [];
  const frame = { postMessage: (data: string, origin: string) => posted.push({ msg: JSON.parse(data), origin }) };
  const saved: string[] = [];
  const writes: any[] = [];
  let closed = 0;
  const session = new EditorSession(() => frame as unknown as Window, ORIGIN, '<mxfile/>', 'Tank', {
    onSave: (xml) => saved.push(xml),
    onClose: () => closed++,
    onWrite: (req) => writes.push(req),
  });
  const send = (data: object, source: unknown = frame, origin = ORIGIN) =>
    session.handle({ source, origin, data: JSON.stringify(data) });

  return { posted, saved, writes, closed: () => closed, session, send, frame };
}

describe('EditorSession', () => {
  it('loads the diagram on init', () => {
    const t = setup();
    expect(t.send({ event: 'init' })).toBe(true);
    expect(t.posted).toEqual([{ msg: { action: 'load', xml: '<mxfile/>', autosave: 1, title: 'Tank' }, origin: ORIGIN }]);
  });

  it('ignores messages from other windows or origins', () => {
    const t = setup();
    expect(t.send({ event: 'autosave', xml: 'x' }, {})).toBe(false);
    expect(t.send({ event: 'autosave', xml: 'x' }, t.frame, 'http://evil.example')).toBe(false);
    expect(t.saved).toEqual([]);
  });

  it('sends host tags and values only after hmiReady', () => {
    const t = setup();
    t.session.update([{ name: 'Level', type: 'number' }], [{ tag: 'Level', value: 4 }]);
    expect(t.posted).toEqual([]);
    t.send({ event: 'hmiReady' });
    expect(t.posted.map((p) => p.msg.action)).toEqual(['hmiSetHostTags', 'hmiSetValues']);
    t.session.update([], [{ tag: 'Level', value: 5 }]);
    expect(t.posted.slice(2).map((p) => p.msg)).toEqual([
      { action: 'hmiSetHostTags', tags: [] },
      { action: 'hmiSetValues', values: [{ tag: 'Level', value: 5 }] },
    ]);
  });

  it('saves on autosave and save, closes on save with exit and on exit', () => {
    const t = setup();
    t.send({ event: 'autosave', xml: 'a' });
    t.send({ event: 'save', xml: 'b', exit: false });
    expect(t.closed()).toBe(0);
    t.send({ event: 'save', xml: 'c', exit: true });
    t.send({ event: 'exit', modified: false });
    expect(t.saved).toEqual(['a', 'b', 'c']);
    expect(t.closed()).toBe(1);
  });

  it('passes writes from Live Preview on', () => {
    const t = setup();
    t.send({ event: 'hmiWrite', tag: 'SetPoint', value: 5, cellId: 'c1' });
    expect(t.writes).toEqual([{ tag: 'SetPoint', value: 5, cellId: 'c1' }]);
  });

  it('ignores data that is not JSON', () => {
    const t = setup();
    expect(t.session.handle({ source: t.frame, origin: ORIGIN, data: 'not json' })).toBe(true);
    expect(t.session.handle({ source: t.frame, origin: ORIGIN, data: { event: 'init' } })).toBe(false);
  });
});

describe('editorParams', () => {
  it('asks for the JSON embed protocol with the HMI plugin', () => {
    const p = editorParams({ dark: true, lang: 'de-DE' });
    expect(p).toContain('embed=1');
    expect(p).toContain('proto=json');
    expect(p).toContain('p=hmi');
    expect(p).toContain('dark=1');
    expect(p).toContain('lang=de-DE');
  });
});

describe('framingAllowed', () => {
  const headers = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null });

  it('follows X-Frame-Options and frame-ancestors', () => {
    expect(framingAllowed(headers({}), ORIGIN)).toBe(true);
    expect(framingAllowed(headers({ 'x-frame-options': 'deny' }), ORIGIN)).toBe(false);
    expect(framingAllowed(headers({ 'x-frame-options': 'SAMEORIGIN' }), ORIGIN)).toBe(true);
    expect(framingAllowed(headers({ 'content-security-policy': "default-src 'self'; frame-ancestors 'self'" }), ORIGIN)).toBe(true);
    expect(framingAllowed(headers({ 'content-security-policy': "frame-ancestors 'none'" }), ORIGIN)).toBe(false);
    expect(framingAllowed(headers({ 'content-security-policy': 'frame-ancestors https://other.example' }), ORIGIN)).toBe(false);
  });
});
