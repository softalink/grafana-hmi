import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import { EditorSessionProps, useEditorSession } from './useEditorSession';

export interface EditorOverlayProps extends EditorSessionProps {
  /** Editor page URL with its parameters. */
  src: string;
}

/**
 * Full-viewport overlay with the draw.io editor in an iframe. Changes are
 * autosaved into the panel option; the overlay closes on Save and exit,
 * Exit, or its close button.
 */
export const EditorOverlay: React.FC<EditorOverlayProps> = (props) => {
  const styles = useStyles2(getStyles);
  const frame = useRef<HTMLIFrameElement>(null);
  useEditorSession(() => frame.current?.contentWindow, props);

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-label="HMI diagram editor" data-testid="hmi-editor-overlay">
      <div className={styles.header}>
        <span className={styles.title}>Edit diagram: {props.title}</span>
        <span className={styles.hint}>Changes are saved to the panel as you edit. Save the dashboard to keep them.</span>
        <Button variant="secondary" icon="times" onClick={() => props.onClose()} aria-label="Close editor">
          Close
        </Button>
      </div>
      <iframe ref={frame} className={styles.frame} src={props.src} title="HMI diagram editor" data-testid="hmi-editor-frame" />
    </div>,
    document.body
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  overlay: css`
    position: fixed;
    inset: 0;
    z-index: ${theme.zIndex.modal + 10};
    display: flex;
    flex-direction: column;
    background: ${theme.colors.background.canvas};
  `,
  header: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(2)};
    padding: ${theme.spacing(1, 2)};
    border-bottom: 1px solid ${theme.colors.border.weak};
    background: ${theme.colors.background.primary};
  `,
  title: css`
    font-weight: ${theme.typography.fontWeightMedium};
  `,
  hint: css`
    flex: 1;
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  frame: css`
    flex: 1;
    width: 100%;
    border: 0;
  `,
});
