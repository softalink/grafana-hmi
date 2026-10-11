import React, { useEffect } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, Stack, useStyles2 } from '@grafana/ui';
import { EditorSessionProps, useEditorSession } from './useEditorSession';

export interface EditorWindowProps extends EditorSessionProps {
  /** The window opened by the click on Edit diagram. */
  win: Window;
}

/**
 * The editor in a separate browser window, for Grafana servers that forbid
 * framing (`allow_embedding` off). Same protocol as the overlay; closing
 * the window ends the session.
 */
export const EditorWindow: React.FC<EditorWindowProps> = (props) => {
  const styles = useStyles2(getStyles);
  const { win, onClose } = props;
  useEditorSession(() => win, props);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (win.closed) {
        onClose();
      }
    }, 500);

    return () => {
      window.clearInterval(timer);
    };
  }, [win, onClose]);

  // Leaving panel edit ends the session: changes after that would be lost
  useEffect(() => {
    return () => {
      if (!win.closed) {
        win.close();
      }
    };
  }, [win]);

  return (
    <Alert severity="info" title="Editing in a separate window" className={styles.alert} data-testid="hmi-editor-window">
      <div>Changes are saved to the panel as you edit. Save the dashboard to keep them.</div>
      <Stack direction="row" gap={1}>
        <Button size="sm" variant="secondary" onClick={() => win.focus()}>
          Show editor
        </Button>
        <Button size="sm" variant="secondary" onClick={() => win.close()}>
          Close editor
        </Button>
      </Stack>
    </Alert>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  alert: css`
    margin-top: ${theme.spacing(1)};
  `,
});
