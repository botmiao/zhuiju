import { RuntimeAdapter } from './runtime-adapter.mjs';
import { ok } from '../lib/result.mjs';

export class OpenClawRuntimeAdapter extends RuntimeAdapter {
  constructor(info, bridge = {}) { super({ ...info, runtime: 'openclaw' }); this.bridge = bridge; }
  async schedule(payload) { return this.bridge.schedule ? ok(await this.bridge.schedule(payload)) : this.unsupported('scheduler'); }
  async unschedule(payload) { return this.bridge.unschedule ? ok(await this.bridge.unschedule(payload)) : this.unsupported('scheduler'); }
  async sendNotification(payload) { return this.bridge.sendNotification ? ok(await this.bridge.sendNotification(payload)) : this.unsupported('notification'); }
  async invokeBrowser(payload) { return this.bridge.invokeBrowser ? ok(await this.bridge.invokeBrowser(payload)) : this.unsupported('browser'); }
}
