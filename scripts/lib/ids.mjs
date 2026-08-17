import { randomUUID } from 'node:crypto';

export function createId(prefix) {
  if (!/^[a-z][a-z0-9_-]*$/.test(prefix)) {
    throw new Error(`Invalid identifier prefix: ${prefix}`);
  }
  return `${prefix}_${randomUUID().replaceAll('-', '')}`;
}
