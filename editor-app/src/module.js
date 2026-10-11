// The HMI editor app has no pages: it only serves the draw.io editor files
// (editor/index.html), which the HMI panel opens in an iframe.
define(['@grafana/data'], function (data) {
  'use strict';

  return { plugin: new data.AppPlugin() };
});
