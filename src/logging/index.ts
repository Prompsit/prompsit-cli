// Logging barrel: pure re-exports from logger.ts.
//
// IMPORTANT: This module must remain free of handler imports to avoid
// circular dependencies. Setup logic lives in ./setup.ts.

export { getTraceId, traceStore, getLogger } from "./logger.ts";
export type { ModuleLogger } from "./logger.ts";
