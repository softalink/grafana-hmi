import { PanelPlugin } from '@grafana/data';
import { HmiPanel } from './components/HmiPanel';
import { DEFAULT_EDITOR_URL } from './defaults';
import { DiagramOption } from './editor/DiagramOption';
import { HmiOptions } from './types';

export const plugin = new PanelPlugin<HmiOptions>(HmiPanel).setPanelOptions((builder) => {
  return builder
    .addCustomEditor({
      id: 'diagram',
      path: 'diagram',
      name: 'Diagram',
      description: 'The HMI screen: a draw.io diagram with animation links',
      editor: DiagramOption,
      defaultValue: '',
    })
    .addRadio({
      path: 'fit',
      name: 'Fit',
      description: 'How the screen is scaled to the panel',
      defaultValue: 'page',
      settings: {
        options: [
          { value: 'page', label: 'Page' },
          { value: 'width', label: 'Width' },
          { value: 'none', label: 'None' },
        ],
      },
    })
    .addSelect({
      path: 'sim',
      name: 'Simulation',
      description: "Simulated values for demos; Diagram uses the screen's own setting",
      defaultValue: 'diagram',
      settings: {
        options: [
          { value: 'diagram', label: 'Diagram setting' },
          { value: 'off', label: 'Off' },
          { value: 'on', label: 'On (with real sources)' },
          { value: 'only', label: 'Only (no connections)' },
        ],
      },
    })
    .addTextInput({
      path: 'tagMapping',
      name: 'Tag mapping',
      category: ['Data'],
      description: 'One "grafana name = tag name" per line. Fields are otherwise named after their display name.',
      defaultValue: '',
      settings: { useTextarea: true, rows: 4 },
    })
    .addBooleanSwitch({
      path: 'applyVariables',
      name: 'Apply dashboard variables',
      category: ['Data'],
      description: 'Replaces ${variable} in the diagram before it loads',
      defaultValue: true,
    })
    .addRadio({
      path: 'writeMode',
      name: 'Writes',
      category: ['Writes'],
      description: 'Writes to tags of a "host" data source of the screen',
      defaultValue: 'off',
      settings: {
        options: [
          { value: 'off', label: 'Off' },
          { value: 'http', label: 'HTTP POST' },
        ],
      },
    })
    .addTextInput({
      path: 'writeUrl',
      name: 'Write URL',
      category: ['Writes'],
      description: 'Receives {tag, value, dashboardUid, panelId} as JSON, e.g. a data source proxy route',
      defaultValue: '',
      showIf: (o) => o.writeMode === 'http',
    })
    .addRadio({
      path: 'writeMinRole',
      name: 'Minimum role for writes',
      category: ['Writes'],
      defaultValue: 'Editor',
      settings: {
        options: [
          { value: 'Viewer', label: 'Viewer' },
          { value: 'Editor', label: 'Editor' },
          { value: 'Admin', label: 'Admin' },
        ],
      },
      showIf: (o) => o.writeMode === 'http',
    })
    .addRadio({
      path: 'editorMode',
      name: 'Editor',
      category: ['Advanced'],
      description:
        'Overlay shows the editor over Grafana in an iframe, which needs allow_embedding. Auto uses a window when Grafana forbids framing.',
      defaultValue: 'auto',
      settings: {
        options: [
          { value: 'auto', label: 'Auto' },
          { value: 'overlay', label: 'Overlay' },
          { value: 'window', label: 'Window' },
        ],
      },
    })
    .addTextInput({
      path: 'editorUrl',
      name: 'Editor URL',
      category: ['Advanced'],
      description: 'The draw.io editor page, served by the HMI editor app plugin',
      defaultValue: DEFAULT_EDITOR_URL,
    });
});
