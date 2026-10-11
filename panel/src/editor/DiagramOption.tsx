import React, { useEffect, useMemo, useRef, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, StandardEditorProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Button, Stack, useStyles2 } from '@grafana/ui';
import { framesToValues, parseMapping, resolveUrl } from '../bridge';
import { DEFAULT_EDITOR_URL, EMPTY_DIAGRAM, RUNTIME_PATH } from '../defaults';
import { sendWrite } from '../runtime/writes';
import { HmiOptions, WriteRequest } from '../types';
import { EditorOverlay } from './EditorOverlay';
import { EditorWindow } from './EditorWindow';
import { ProbeResult, probeEditor } from './embedding';
import { editorParams } from './session';

/** Pages and objects with HMI links of a diagram, for the summary line. */
export function summarize(xml: string | undefined): { pages: number; linked: number } | null {
  if (!xml) {
    return null;
  }

  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');

    if (doc.getElementsByTagName('parsererror').length > 0) {
      return null;
    }

    const pages = Math.max(1, doc.getElementsByTagName('diagram').length);
    const attrs = ['hmiLinks', 'hmiBindings', 'hmiEvents', 'hmiTriggers', 'hmiAnimations'];
    let linked = 0;
    const objects = doc.getElementsByTagName('object');

    for (let i = 0; i < objects.length; i++) {
      if (attrs.some((a) => objects[i].hasAttribute(a))) {
        linked++;
      }
    }

    return { pages, linked };
  } catch (e) {
    return null;
  }
}

/**
 * Panel option for the diagram: a summary and the buttons that open the
 * editor, load the demo, import and download a .drawio file.
 */
export const DiagramOption: React.FC<StandardEditorProps<string, unknown, HmiOptions>> = ({
  value,
  onChange,
  context,
}) => {
  const styles = useStyles2(getStyles);
  const [editing, setEditing] = useState<{ mode: 'overlay' } | { mode: 'window'; win: Window } | null>(null);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const options = (context.options || {}) as HmiOptions;
  const summary = useMemo(() => summarize(value), [value]);
  const bridged = useMemo(
    () => framesToValues(context.data, parseMapping(options.tagMapping)),
    [context.data, options.tagMapping]
  );

  const editorUrl = resolveUrl(config.appSubUrl, options.editorUrl || DEFAULT_EDITOR_URL);
  const mode = options.editorMode || 'auto';

  // Whether the editor is installed and Grafana allows framing it
  useEffect(() => {
    let cancelled = false;
    probeEditor(editorUrl, window.location.origin).then((result) => !cancelled && setProbe(result));

    return () => {
      cancelled = true;
    };
  }, [editorUrl]);

  const edit = () => {
    setError(null);

    if (probe === 'missing') {
      setError(`The editor was not found at ${editorUrl}. Install and enable the HMI Editor app plugin.`);
      return;
    }

    const src =
      editorUrl +
      (editorUrl.indexOf('?') >= 0 ? '&' : '?') +
      editorParams({ dark: config.theme2.isDark, lang: config.bootData?.user?.language });
    const useWindow = mode === 'window' || (mode === 'auto' && probe === 'window');

    if (!useWindow) {
      setEditing({ mode: 'overlay' });
      return;
    }

    // Opened in the click handler, so popup blockers allow it
    const win = window.open(src, 'hmi-editor', 'popup,width=1440,height=900');

    if (win == null) {
      setError('The browser blocked the editor window. Allow popups for Grafana and try again.');
    } else {
      setEditing({ mode: 'window', win });
    }
  };

  const session = {
    xml: value || EMPTY_DIAGRAM,
    title: 'HMI panel',
    tags: bridged.tags,
    values: bridged.values,
    onSave: (xml: string) => onChange(xml),
    onClose: () => setEditing(null),
    onWrite: (req: WriteRequest) => sendWrite(options, req, { replaceVariables: (v) => v }),
  };

  const loadDemo = async () => {
    setError(null);

    try {
      const res = await fetch(resolveUrl(config.appSubUrl, RUNTIME_PATH + 'templates/intouch_links_demo.xml'));

      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }

      onChange(await res.text());
    } catch (e: any) {
      setError('The demo could not be loaded: ' + e.message);
    }
  };

  const importFile = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const f = evt.target.files?.[0];

    if (f != null) {
      f.text().then((text) => {
        if (summarize(text) == null) {
          setError(f.name + ' is not a draw.io diagram');
        } else {
          setError(null);
          onChange(text);
        }
      });
    }

    evt.target.value = '';
  };

  const download = () => {
    const blob = new Blob([value || EMPTY_DIAGRAM], { type: 'application/xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hmi-screen.drawio';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div>
      <div className={styles.summary} data-testid="hmi-diagram-summary">
        {summary == null
          ? 'No diagram yet'
          : `${summary.pages} page${summary.pages === 1 ? '' : 's'}, ${summary.linked} object${
              summary.linked === 1 ? '' : 's'
            } with links`}
      </div>
      <Stack direction="row" wrap="wrap" gap={1}>
        <Button icon="edit" onClick={edit} data-testid="hmi-edit-diagram" disabled={editing != null}>
          Edit diagram
        </Button>
        <Button variant="secondary" onClick={loadDemo}>
          Load demo
        </Button>
        <Button variant="secondary" icon="upload" onClick={() => file.current?.click()}>
          Import
        </Button>
        <Button variant="secondary" icon="download-alt" onClick={download} disabled={!value}>
          Download
        </Button>
      </Stack>
      <input ref={file} type="file" accept=".drawio,.xml" hidden onChange={importFile} />
      {error != null && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      {editing != null &&
        (editing.mode === 'overlay' ? (
          <EditorOverlay
            src={
              editorUrl +
              (editorUrl.indexOf('?') >= 0 ? '&' : '?') +
              editorParams({ dark: config.theme2.isDark, lang: config.bootData?.user?.language })
            }
            {...session}
          />
        ) : (
          <EditorWindow win={editing.win} {...session} />
        ))}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  summary: css`
    color: ${theme.colors.text.secondary};
    margin-bottom: ${theme.spacing(1)};
  `,
  error: css`
    margin-top: ${theme.spacing(1)};
    color: ${theme.colors.error.text};
  `,
});
