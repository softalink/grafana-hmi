import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, PanelProps } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { framesToValues, hmiRoles, parseMapping, resolveUrl } from '../bridge';
import { EMPTY_DIAGRAM, RUNTIME_PATH } from '../defaults';
import { loadRuntime } from '../runtime/loader';
import { ViewerHandle } from '../runtime/viewer';
import { sendWrite } from '../runtime/writes';
import { HmiOptions, WriteRequest } from '../types';

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Formats a dashboard variable for use inside the diagram's XML attributes. */
export function formatVariable(value: string | string[]): string {
  return xmlEscape(Array.isArray(value) ? value.join(',') : String(value));
}

export function runtimeBase(): string {
  return resolveUrl(config.appSubUrl, RUNTIME_PATH);
}

export const HmiPanel: React.FC<PanelProps<HmiOptions>> = ({ options, data, width, height, replaceVariables, id }) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<ViewerHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Latest values for callbacks that outlive a render
  const latest = useRef({ options, replaceVariables, id });

  useLayoutEffect(() => {
    latest.current = { options, replaceVariables, id };
  });

  useEffect(() => {
    let cancelled = false;

    loadRuntime(runtimeBase()).then(
      () => !cancelled && setReady(true),
      (e: Error) => !cancelled && setError(e.message)
    );

    return () => {
      cancelled = true;
    };
  }, []);

  // Not memoized on replaceVariables: it keeps its identity when a variable
  // changes. The viewer is remounted only when the resulting XML differs.
  const diagram = options.diagram || EMPTY_DIAGRAM;
  const xml = options.applyVariables !== false ? replaceVariables(diagram, undefined, formatVariable) : diagram;

  const mapping = useMemo(() => parseMapping(options.tagMapping), [options.tagMapping]);
  const bridged = useMemo(() => framesToValues(data.series, mapping), [data.series, mapping]);
  const bridgedRef = useRef(bridged);

  useLayoutEffect(() => {
    bridgedRef.current = bridged;
  });

  const orgRole = config.bootData?.user?.orgRole;
  const roles = useMemo(() => hmiRoles(orgRole), [orgRole]);
  const sim = options.sim && options.sim !== 'diagram' ? options.sim : undefined;
  const dark = theme.isDark;

  // One viewer per diagram; remounted when what it was started with changes
  useEffect(() => {
    if (!ready || host.current == null) {
      return;
    }

    setError(null);
    const onWrite = (req: WriteRequest) => {
      const cur = latest.current;
      const dashboardUid = /\/d\/([^/]+)/.exec(locationService.getLocation().pathname)?.[1];
      sendWrite(cur.options, req, { panelId: cur.id, dashboardUid, replaceVariables: (v) => cur.replaceVariables(v) });
    };
    const h = new ViewerHandle(host.current, xml, {
      sim,
      roles,
      dark,
      fit: options.fit || 'page',
      onWrite,
      onError: (message) => setError(message),
    });
    handle.current = h;
    h.setValues(bridgedRef.current.values);

    return () => {
      h.destroy();

      if (handle.current === h) {
        handle.current = null;
      }
    };
  }, [ready, xml, sim, roles, dark, options.fit]);

  useEffect(() => {
    handle.current?.setValues(bridged.values);
  }, [bridged, ready, xml]);

  useEffect(() => {
    handle.current?.resize(width, height);
  }, [width, height, ready, xml, options.fit]);

  return (
    <div className={styles.wrapper} style={{ width, height }} data-testid="hmi-panel">
      <div ref={host} className={styles.host} data-testid="hmi-panel-host" />
      {error != null && (
        <div className={styles.error} role="alert" data-testid="hmi-panel-error">
          {error}
        </div>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    position: relative;
    overflow: hidden;
  `,
  host: css`
    position: absolute;
    inset: 0;
    &:focus-within {
      outline: none;
    }
  `,
  error: css`
    position: absolute;
    left: ${theme.spacing(1)};
    right: ${theme.spacing(1)};
    top: ${theme.spacing(1)};
    padding: ${theme.spacing(1)};
    color: ${theme.colors.error.text};
    background: ${theme.colors.background.primary};
    border: 1px solid ${theme.colors.error.border};
    border-radius: ${theme.shape.radius.default};
  `,
});
