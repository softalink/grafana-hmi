export const PLUGIN_ID = 'softalink-hmi-panel';
export const EDITOR_APP_ID = 'softalink-hmieditor-app';

/** Where the panel plugin serves the draw.io runtime files. */
export const RUNTIME_PATH = `public/plugins/${PLUGIN_ID}/drawio/`;

/** Default editor page, served by the editor app plugin. */
export const DEFAULT_EDITOR_URL = `public/plugins/${EDITOR_APP_ID}/editor/index.html`;

/** An empty one-page diagram with an empty HMI configuration. */
export const EMPTY_DIAGRAM =
  '<mxfile><diagram id="hmi-page-1" name="Page-1"><mxGraphModel grid="1" gridSize="10" page="1" ' +
  'pageWidth="1280" pageHeight="720"><root>' +
  '<object id="0" hmi="{&quot;version&quot;:1,&quot;sources&quot;:[],&quot;tags&quot;:[],&quot;triggers&quot;:[]}">' +
  '<mxCell/></object><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>';
