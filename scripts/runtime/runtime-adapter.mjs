import { fail } from '../lib/result.mjs';

export class RuntimeAdapter {
  constructor(info) { this.info = info; }
  unsupported(capability) { return fail('UNSUPPORTED_CAPABILITY', `${capability} is not available in this runtime`, false, { capability }); }
  async getRuntimeInfo() { return this.info; }
  async schedule() { return this.unsupported('scheduler'); }
  async unschedule() { return this.unsupported('scheduler'); }
  async sendNotification() { return this.unsupported('notification'); }
  async invokeBrowser() { return this.unsupported('browser'); }
}
