import { RuntimeAdapter } from './runtime-adapter.mjs';

export class GenericLocalRuntimeAdapter extends RuntimeAdapter {
  constructor(info) { super({ ...info, runtime: info.runtime || 'generic-local-agent' }); }
}
