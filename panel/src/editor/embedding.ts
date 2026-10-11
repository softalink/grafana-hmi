export type EditorMode = 'auto' | 'overlay' | 'window';
export type ProbeResult = 'overlay' | 'window' | 'missing';

/**
 * True if a page with these response headers may be shown in an iframe of
 * a page of the same origin. Grafana sends `X-Frame-Options: deny` on every
 * response unless `security.allow_embedding` is on.
 */
export function framingAllowed(headers: { get(name: string): string | null }, origin: string): boolean {
  const xfo = (headers.get('x-frame-options') || '').toLowerCase();

  if (xfo.includes('deny')) {
    return false;
  }

  const csp = headers.get('content-security-policy') || '';
  const match = /frame-ancestors([^;]*)/i.exec(csp);

  if (match != null) {
    const sources = match[1].trim().split(/\s+/);

    return sources.some((s) => s === "'self'" || s === '*' || s === origin || s === origin + '/');
  }

  return true;
}

/** Checks whether the editor page exists and may be shown in an iframe. */
export async function probeEditor(url: string, origin: string): Promise<ProbeResult> {
  try {
    const res = await fetch(url, { method: 'HEAD', credentials: 'same-origin' });

    if (!res.ok) {
      return 'missing';
    }

    return framingAllowed(res.headers, origin) ? 'overlay' : 'window';
  } catch (e) {
    return 'missing';
  }
}
