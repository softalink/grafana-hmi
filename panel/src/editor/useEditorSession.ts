import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HostTag, TagValue, WriteRequest } from '../types';
import { EditorSession } from './session';

export interface EditorSessionProps {
  xml: string;
  title: string;
  tags: HostTag[];
  values: TagValue[];
  onSave: (xml: string) => void;
  onClose: () => void;
  onWrite?: (req: WriteRequest) => void;
}

/**
 * Runs the editor protocol with the window returned by target (the
 * overlay's iframe or a separate window) while the component is mounted.
 */
export function useEditorSession(target: () => Window | null | undefined, props: EditorSessionProps) {
  const session = useRef<EditorSession | null>(null);
  const callbacks = useRef(props);
  const targetRef = useRef(target);

  // The diagram is loaded once; later option changes come from the editor
  const [initial] = useState(() => ({ xml: props.xml, title: props.title }));

  useLayoutEffect(() => {
    callbacks.current = props;
    targetRef.current = target;
  });

  useEffect(() => {
    const s = new EditorSession(
      () => targetRef.current(),
      window.location.origin,
      initial.xml,
      initial.title,
      {
        onSave: (xml) => callbacks.current.onSave(xml),
        onClose: () => callbacks.current.onClose(),
        onWrite: (req) => callbacks.current.onWrite?.(req),
      }
    );
    session.current = s;
    const listener = (evt: MessageEvent) => {
      s.handle(evt);
    };
    window.addEventListener('message', listener);

    return () => {
      window.removeEventListener('message', listener);
      session.current = null;
    };
  }, [initial]);

  useEffect(() => {
    session.current?.update(props.tags, props.values);
  }, [props.tags, props.values]);
}
