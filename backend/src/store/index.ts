import type { Config } from '../config.js';
import { MemoryStore } from './memory.js';
import { PostgresStore } from './postgres.js';
import type { Store } from './types.js';

export type { Store } from './types.js';
export { ConflictError } from './types.js';
export { MemoryStore } from './memory.js';
export { PostgresStore } from './postgres.js';

export function createStore(config: Config): Store {
  return config.databaseUrl ? new PostgresStore(config.databaseUrl, config.pgSsl) : new MemoryStore();
}
