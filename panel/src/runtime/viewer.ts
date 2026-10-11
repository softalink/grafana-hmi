import { FitMode, GraphViewerInstance, HmiApi, TagValue, WriteRequest } from '../types';

export interface MountOptions {
  sim?: string;
  roles: string[];
  dark: boolean;
  fit: FitMode;
  onWrite: (req: WriteRequest) => void;
  onError: (message: string) => void;
}

const TOOLBAR_HEIGHT = 26;

/** Number of pages (diagram elements) of an mxfile, at least 1. */
export function countPages(node: Element): number {
  return node.nodeName === 'mxfile' ? Math.max(1, node.getElementsByTagName('diagram').length) : 1;
}

/**
 * One HMI screen in a panel: a GraphViewer with the HMI runtime attached
 * (Hmi.Viewer.attach), scaled to the panel.
 */
export class ViewerHandle {
  private viewer: GraphViewerInstance | null = null;
  private api: HmiApi | null = null;
  private pending: TagValue[] | null = null;
  private width = 0;
  private height = 0;
  private destroyed = false;
  private toolbar = false;

  constructor(
    private readonly container: HTMLDivElement,
    xml: string,
    private readonly opts: MountOptions
  ) {
    const w = window as any;
    let node: Element;

    try {
      const doc = w.mxUtils.parseXml(xml);
      node = doc.documentElement;

      if (node == null || node.nodeName === 'parsererror' || doc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('The diagram is not valid XML');
      }
    } catch (e) {
      opts.onError((e as Error).message);
      return;
    }

    this.toolbar = countPages(node) > 1;
    const div = document.createElement('div');
    container.appendChild(div);

    this.viewer = new w.GraphViewer(div, node, {
      highlight: 'none',
      nav: false,
      resize: false,
      center: false,
      lightbox: false,
      toolbar: this.toolbar ? 'pages' : null,
      'toolbar-position': 'top',
      'toolbar-nohide': true,
      'dark-mode': opts.dark ? 'dark' : 'light',
      hmi: {
        interactive: true,
        sim: opts.sim,
        roles: opts.roles,
        keyScope: 'container',
      },
    }) as GraphViewerInstance;

    this.waitForApi(0);
  }

  /** Hmi.Viewer.attach runs in a timeout after the viewer is created. */
  private waitForApi(attempt: number) {
    window.setTimeout(() => {
      if (this.destroyed || this.viewer == null) {
        return;
      }

      const api = this.viewer.hmi;

      if (api == null) {
        if (attempt < 50) {
          this.waitForApi(attempt + 1);
        } else {
          this.opts.onError('The HMI runtime did not start');
        }

        return;
      }

      this.api = api;
      const rt = api.getRuntime();

      if (rt != null) {
        // Writes to tags of a "host" data source
        rt.on('hostWrite', (req: WriteRequest) => this.opts.onWrite(req));
      }

      // The page toolbar changes the page: fit the new one
      const viewer = this.viewer as any;
      const selectPage = viewer.selectPage;

      if (typeof selectPage === 'function') {
        viewer.selectPage = (...args: unknown[]) => {
          selectPage.apply(viewer, args);
          this.fit();
        };
      }

      if (this.pending != null) {
        api.setValues(this.pending);
        this.pending = null;
      }

      this.fit();
    }, attempt === 0 ? 0 : 20);
  }

  getApi(): HmiApi | null {
    return this.api;
  }

  setValues(values: TagValue[]) {
    if (this.api != null) {
      this.api.setValues(values);
    } else {
      this.pending = values;
    }
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.fit();
  }

  /** Scales the design area (runtime width and height, else the diagram bounds) to the panel. */
  fit() {
    const graph = this.viewer?.graph;

    if (graph == null || graph.container == null || this.width <= 0 || this.height <= 0) {
      return;
    }

    const top = this.toolbar ? TOOLBAR_HEIGHT : 0;
    const cw = this.width;
    const ch = Math.max(1, this.height - top);
    const container = graph.container as HTMLElement;
    const cs = container.style;
    cs.width = cw + 'px';
    cs.height = ch + 'px';
    cs.minWidth = '';
    cs.minHeight = '';
    cs.maxWidth = '';
    cs.maxHeight = '';
    cs.marginTop = top + 'px';
    cs.overflow = this.opts.fit === 'page' ? 'hidden' : 'auto';

    const view = graph.view;
    const rt = this.api?.getRuntime();
    const rw = rt?.config?.runtime?.width ?? 0;
    const rh = rt?.config?.runtime?.height ?? 0;
    let area: { x: number; y: number; width: number; height: number };

    if (rw > 0 && rh > 0) {
      area = { x: 0, y: 0, width: rw, height: rh };
    } else {
      const b = graph.getGraphBounds();
      const s = view.scale;

      if (b.width === 0 || b.height === 0) {
        return;
      }

      area = { x: b.x / s - view.translate.x, y: b.y / s - view.translate.y, width: b.width / s, height: b.height / s };
    }

    const fit = this.opts.fit;
    const scale =
      fit === 'none' ? 1 : Math.max(0.05, fit === 'width' ? cw / area.width : Math.min(cw / area.width, ch / area.height));
    const tx = Math.max(0, (cw / scale - area.width) / 2) - area.x;
    const ty = (fit === 'page' ? Math.max(0, (ch / scale - area.height) / 2) : 0) - area.y;
    view.scaleAndTranslate(scale, tx, ty);
  }

  destroy() {
    this.destroyed = true;

    if (this.viewer != null) {
      const w = window as any;

      try {
        w.Hmi.Viewer.detach(this.viewer);
      } catch (e) {
        // ignore
      }

      this.viewer = null;
      this.api = null;
    }

    this.container.innerHTML = '';
  }
}
