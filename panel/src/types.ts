export type FitMode = 'page' | 'width' | 'none';
export type SimMode = 'diagram' | 'off' | 'on' | 'only';
export type WriteMode = 'off' | 'http';
export type MinRole = 'Viewer' | 'Editor' | 'Admin';

export interface HmiOptions {
  /** The draw.io diagram (mxfile XML) with the HMI configuration. */
  diagram: string;
  fit: FitMode;
  sim: SimMode;
  /** Replaces dashboard variables in the diagram before it loads. */
  applyVariables: boolean;
  /** One `grafana name = tag name` per line. */
  tagMapping: string;
  writeMode: WriteMode;
  writeUrl: string;
  writeMinRole: MinRole;
  /** Editor page, relative to Grafana's sub path or absolute. */
  editorUrl: string;
  /** Overlay (iframe), separate window, or auto: overlay when Grafana allows framing. */
  editorMode: 'auto' | 'overlay' | 'window';
}

/** One tag value pushed into the HMI runtime. */
export interface TagValue {
  tag: string;
  value: unknown;
  ts?: number;
}

/** A tag offered to the editor's tag pickers. */
export interface HostTag {
  name: string;
  type: 'number' | 'boolean' | 'string' | 'object';
  unit?: string;
  description?: string;
}

/** A write request from the HMI runtime (a touch link or a script). */
export interface WriteRequest {
  tag: string;
  value: unknown;
  cellId?: string;
}

/** Minimal view of the HMI runtime API (Hmi.Api in the drawio repo). */
export interface HmiApi {
  isRunning(): boolean;
  stop(): void;
  setValues(values: TagValue[] | Record<string, unknown>): number;
  getValue(tag: string): unknown;
  getRuntime(): HmiRuntime | null;
}

export interface HmiRuntime {
  on(name: string, fn: (arg: any) => void): void;
  config: { runtime?: { width?: number; height?: number } };
}

export interface GraphViewerInstance {
  hmi: HmiApi | null;
  graph: any;
  diagrams?: Element[];
}
