import { HostTag, TagValue, WriteRequest } from '../types';

export interface SessionCallbacks {
  /** Diagram XML from autosave or save. */
  onSave: (xml: string) => void;
  onClose: () => void;
  onWrite?: (req: WriteRequest) => void;
}

/** URL parameters of the embedded editor (draw.io embed protocol, JSON). */
export function editorParams(opts: { dark: boolean; lang?: string }): string {
  const params = [
    'embed=1',
    'proto=json',
    'p=hmi',
    'spin=1',
    'saveAndExit=1',
    'noSaveBtn=1',
    'stealth=1',
    'dark=' + (opts.dark ? '1' : '0'),
  ];

  if (opts.lang) {
    params.push('lang=' + encodeURIComponent(opts.lang));
  }

  return params.join('&');
}

/**
 * The panel side of the editor protocol: draw.io's embed messages (init,
 * load, autosave, save, exit) and the HMI messages (hmiReady,
 * hmiSetHostTags, hmiSetValues, hmiWrite).
 */
export class EditorSession {
  private ready = false;
  private tags: HostTag[] = [];
  private values: TagValue[] = [];
  private closed = false;

  constructor(
    private readonly target: () => Window | null | undefined,
    private readonly origin: string,
    private readonly xml: string,
    private readonly title: string,
    private readonly cb: SessionCallbacks
  ) {}

  /** Handles a window message. Returns true if it came from the editor. */
  handle(evt: { source: unknown; origin: string; data: unknown }): boolean {
    const frame = this.target();

    if (frame == null || evt.source !== frame || evt.origin !== this.origin || typeof evt.data !== 'string') {
      return false;
    }

    let msg: any;

    try {
      msg = JSON.parse(evt.data);
    } catch (e) {
      return true;
    }

    switch (msg?.event) {
      case 'init':
        this.post({ action: 'load', xml: this.xml, autosave: 1, title: this.title });
        break;

      case 'hmiReady':
        this.ready = true;
        this.flush();
        break;

      case 'autosave':
        if (typeof msg.xml === 'string') {
          this.cb.onSave(msg.xml);
        }
        break;

      case 'save':
        if (typeof msg.xml === 'string') {
          this.cb.onSave(msg.xml);
        }

        if (msg.exit) {
          this.close();
        }
        break;

      case 'exit':
        this.close();
        break;

      case 'hmiWrite':
        if (this.cb.onWrite != null && typeof msg.tag === 'string') {
          this.cb.onWrite({ tag: msg.tag, value: msg.value, cellId: msg.cellId });
        }
        break;
    }

    return true;
  }

  /** New query results: tags for the pickers, values for Live Preview. */
  update(tags: HostTag[], values: TagValue[]) {
    this.tags = tags;
    this.values = values;

    if (this.ready) {
      this.flush();
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  private flush() {
    this.post({ action: 'hmiSetHostTags', tags: this.tags });

    if (this.values.length > 0) {
      this.post({ action: 'hmiSetValues', values: this.values });
    }
  }

  private close() {
    if (!this.closed) {
      this.closed = true;
      this.cb.onClose();
    }
  }

  private post(msg: object) {
    this.target()?.postMessage(JSON.stringify(msg), this.origin);
  }
}
