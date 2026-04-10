// Centralized error code registry for the Prompsit CLI.
// Single source of truth: all E-codes referenced across the codebase.

export const ErrorCode = {
  // Network & general
  NETWORK: "E0001",
  JOB_FAILED: "E0002",
  CANCELLED: "E0003",
  ZOD_VALIDATION: "E0004",
  // Config
  CONFIG_INVALID: "E3001",
  CONFIG_WRITE: "E3002",
  CONFIG_INTERACTIVE: "E3003",
  CONFIG_TOML_PARSE: "E3004",
  CONFIG_TOML_WRITE: "E3005",
  CONFIG_LOGIN_REQUIRED: "E3010",
  CONFIG_TRANSLATE: "E3011",
  // Auth
  AUTH_FAILED: "E4001",
  DEVICE_FLOW_EXPIRED: "E4010",
  DEVICE_FLOW_DENIED: "E4011",
  FORBIDDEN: "E4031",
  VALIDATION: "E4221",
  RATE_LIMITED: "E4291",
  SERVER_ERROR: "E5001",
  // Fallback
  UNKNOWN: "E9999",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
