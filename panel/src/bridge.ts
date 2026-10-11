import { DataFrame, Field, FieldType, getFieldDisplayName } from '@grafana/data';
import { HostTag, MinRole, TagValue } from './types';

/**
 * Parses the Tag mapping option: one `grafana name = tag name` per line.
 * Empty lines and lines starting with # are ignored.
 */
export function parseMapping(text: string | undefined): Map<string, string> {
  const result = new Map<string, string>();

  for (const raw of (text || '').split(/\r?\n/)) {
    const line = raw.trim();
    const eq = line.indexOf('=');

    if (line === '' || line.startsWith('#') || eq <= 0) {
      continue;
    }

    const from = line.substring(0, eq).trim();
    const to = line.substring(eq + 1).trim();

    if (from !== '' && to !== '') {
      result.set(from, to);
    }
  }

  return result;
}

function tagType(field: Field): HostTag['type'] {
  switch (field.type) {
    case FieldType.number:
      return 'number';
    case FieldType.boolean:
      return 'boolean';
    case FieldType.string:
    case FieldType.enum:
      return 'string';
    default:
      return 'object';
  }
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return value;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  return undefined;
}

/**
 * Turns query results into tag values (the last non-null value of each
 * field other than time, with the time field's value at that row as the
 * timestamp) and the matching tag list for the editor.
 */
export function framesToValues(
  frames: DataFrame[] | undefined,
  mapping: Map<string, string>
): { values: TagValue[]; tags: HostTag[] } {
  const values = new Map<string, TagValue>();
  const tags = new Map<string, HostTag>();
  const all = frames || [];

  for (const frame of all) {
    const timeField = frame.fields.find((f) => f.type === FieldType.time);

    for (const field of frame.fields) {
      if (field === timeField || field.type === FieldType.time) {
        continue;
      }

      const display = getFieldDisplayName(field, frame, all);
      const name = mapping.get(display) ?? mapping.get(field.name) ?? display;
      const tag: HostTag = { name, type: tagType(field) };

      if (field.config?.unit) {
        tag.unit = field.config.unit;
      }

      if (field.config?.description) {
        tag.description = field.config.description;
      }

      tags.set(name, tag);

      for (let i = field.values.length - 1; i >= 0; i--) {
        const value = field.values[i];

        if (value !== null && value !== undefined) {
          const entry: TagValue = { tag: name, value };
          const ts = timeField != null ? toNumber(timeField.values[i]) : undefined;

          if (ts !== undefined) {
            entry.ts = ts;
          }

          values.set(name, entry);
          break;
        }
      }
    }
  }

  return { values: Array.from(values.values()), tags: Array.from(tags.values()) };
}

const ROLE_ORDER: MinRole[] = ['Viewer', 'Editor', 'Admin'];

/** True if the Grafana org role is at least `min`. */
export function hasMinRole(orgRole: string | undefined, min: MinRole): boolean {
  const have = ROLE_ORDER.indexOf((orgRole || '') as MinRole);

  return have >= 0 && have >= ROLE_ORDER.indexOf(min);
}

/** HMI roles for a Grafana org role: Viewer, plus Editor, plus Admin. */
export function hmiRoles(orgRole: string | undefined): string[] {
  const have = ROLE_ORDER.indexOf((orgRole || '') as MinRole);

  return ROLE_ORDER.slice(0, have + 1).map((r) => r.toLowerCase());
}

/**
 * Resolves a URL option: absolute URLs stay, others are relative to
 * Grafana's sub path (`config.appSubUrl`).
 */
export function resolveUrl(appSubUrl: string, url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const base = (appSubUrl || '').replace(/\/$/, '');

  return base + (url.startsWith('/') ? url : '/' + url);
}
