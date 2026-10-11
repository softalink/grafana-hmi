import { AppEvents } from '@grafana/data';
import { config, getAppEvents, getBackendSrv } from '@grafana/runtime';
import { hasMinRole, resolveUrl } from '../bridge';
import { HmiOptions, WriteRequest } from '../types';

export interface WriteContext {
  dashboardUid?: string;
  panelId?: number;
  replaceVariables: (value: string) => string;
}

function toast(type: string, text: string) {
  getAppEvents().publish({ type, payload: [text] });
}

/**
 * Sends a write from the HMI runtime according to the panel's write
 * options. Returns true if it was sent.
 */
export async function sendWrite(options: HmiOptions, req: WriteRequest, ctx: WriteContext): Promise<boolean> {
  if (options.writeMode !== 'http' || !options.writeUrl) {
    toast(AppEvents.alertWarning.name, `Writes are off for this panel (${req.tag} not written)`);
    return false;
  }

  if (!hasMinRole(config.bootData?.user?.orgRole, options.writeMinRole || 'Editor')) {
    toast(AppEvents.alertError.name, `Your role cannot write ${req.tag}`);
    return false;
  }

  const url = resolveUrl(config.appSubUrl, ctx.replaceVariables(options.writeUrl));

  try {
    await getBackendSrv().post(url, {
      tag: req.tag,
      value: req.value,
      dashboardUid: ctx.dashboardUid,
      panelId: ctx.panelId,
    });

    return true;
  } catch (e: any) {
    toast(AppEvents.alertError.name, `Write of ${req.tag} failed: ${e?.statusText || e?.message || e}`);
    return false;
  }
}
