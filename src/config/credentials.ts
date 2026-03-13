// See API-440: Credential Store (JSON Cross-Compatible)
// See API-441: Token Expiry with Monotonic Clock

import fs from "node:fs";
import { z } from "zod";
import { getCredsFile } from "./paths.ts";
import { atomicWriteFile } from "./file-utils.ts";
import { TOKEN_EXPIRY_BUFFER } from "./constants.ts";
import { FILE_MODE_OWNER_RW } from "../shared/constants.ts";

// ===== Zod Schema =====

/**
 * Credential data schema for persisted CLI auth state.
 *
 * Pattern: Tolerant Reader (optional fields on read, strict on write)
 */
const CredentialDataSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().nullish(),
  account_id: z.string().nullish(), // Displayed in REPL status bar
  expires_at: z.number().optional(), // Unix timestamp, calculated from expires_in
  plan: z.string().optional(), // Subscription plan from API
});

type CredentialData = z.infer<typeof CredentialDataSchema>;

/** Options for saveTokens — avoids positional param ambiguity. */
export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  accountId?: string;
  expiresIn?: number;
  plan?: string;
}

// ===== CredentialStore Class =====

/**
 * Credential store with encapsulated cache
 *
 * Pattern: Class-based store with encapsulated cache
 *
 * Cache behavior:
 * - Load once from file, cache in memory
 * - Write updates cache immediately
 * - resetAuthCache() invalidates cache without deleting file
 * - clearTokens() deletes file and resets cache
 */
/** @internal Exported for unit tests only. */
export class CredentialStore {
  private cache: CredentialData | null = null;
  private authenticated: boolean | null = null;
  private expiresAtMono: number | null = null; // Monotonic expiry tracking (performance.now())

  /**
   * Restore monotonic expiry tracking from persisted Unix timestamp.
   * This keeps proactive refresh aligned with real token lifetime after cache reset/process restart.
   */
  private restoreMonotonicExpiry(expiresAtUnix: number | undefined): void {
    if (expiresAtUnix === undefined) {
      this.expiresAtMono = null;
      return;
    }

    const remainingMs = expiresAtUnix * 1000 - Date.now();
    this.expiresAtMono = performance.now() + remainingMs;
  }

  /**
   * Save tokens to credentials.json with atomic write
   *
   * Pattern: Atomic write (temp-file + rename) prevents corruption
   */
  saveTokens(opts: TokenData): void {
    const { accessToken, refreshToken, accountId, expiresIn, plan } = opts;
    const data: Record<string, string | number | undefined> = {
      access_token: accessToken,
    };

    if (refreshToken !== undefined) data.refresh_token = refreshToken;
    if (accountId !== undefined) data.account_id = accountId;
    if (plan !== undefined) data.plan = plan;

    // Calculate expires_at as Unix timestamp
    if (expiresIn === undefined) {
      this.expiresAtMono = null; // Unknown expiry
    } else {
      data.expires_at = Date.now() / 1000 + expiresIn;
      // Track expiry using monotonic clock (immune to system time changes)
      this.expiresAtMono = performance.now() + expiresIn * 1000; // ms
    }

    const credsPath = getCredsFile();

    // Atomic write with JSON indentation
    atomicWriteFile(credsPath, JSON.stringify(data, null, 2));

    // Set file permissions to 0o600 (owner read/write only) on Unix
    // Suppress errors on Windows (chmod not supported)
    try {
      fs.chmodSync(credsPath, FILE_MODE_OWNER_RW);
    } catch {
      // Ignore chmod errors on Windows
    }

    // Update cache
    this.cache = CredentialDataSchema.parse(data);
    this.authenticated = true;
  }

  /** @returns Access token or null if not authenticated. */
  getAccessToken(): string | null {
    return this.loadCache()?.access_token ?? null;
  }

  /** @returns Refresh token or null if not available. */
  getRefreshToken(): string | null {
    return this.loadCache()?.refresh_token ?? null;
  }

  /** @returns Account ID or null if not authenticated. */
  getAccountId(): string | null {
    return this.loadCache()?.account_id ?? null;
  }

  /** @returns Subscription plan string or null. */
  getPlan(): string | null {
    return this.loadCache()?.plan ?? null;
  }

  /** Delete credentials file and reset in-memory cache. */
  clearTokens(): void {
    const credsPath = getCredsFile();

    if (fs.existsSync(credsPath)) {
      fs.unlinkSync(credsPath);
    }

    this.cache = null;
    this.authenticated = false;
    this.expiresAtMono = null; // Reset expiry tracking
  }

  /** @returns True if access token exists (result cached after first check). */
  isAuthenticated(): boolean {
    if (this.authenticated !== null) return this.authenticated;

    const token = this.getAccessToken();
    this.authenticated = token !== null;
    return this.authenticated;
  }

  /**
   * Reset auth cache (invalidate without deleting file)
   *
   * Pattern: Explicit cache invalidation (useful for testing)
   */
  resetAuthCache(): void {
    this.cache = null;
    this.authenticated = null;
    this.expiresAtMono = null; // Reset expiry tracking
  }

  /**
   * Check if token is expired or will expire within buffer
   *
   * Pattern: Monotonic clock (performance.now()) immune to system time changes
   *
   * @param bufferSeconds - Seconds before actual expiry to consider expired (default: TOKEN_EXPIRY_BUFFER)
   * @returns True if token expired or unknown (null), false if still valid
   */
  isTokenExpired(bufferSeconds: number = TOKEN_EXPIRY_BUFFER): boolean {
    // Unknown expiry = expired (triggers proactive refresh on fresh process start)
    if (this.expiresAtMono === null) return true;

    const bufferMs = bufferSeconds * 1000;
    return performance.now() >= this.expiresAtMono - bufferMs;
  }

  /**
   * Load credentials from file with in-memory cache
   *
   * Pattern: Lazy load + cache for performance
   *
   * @returns Credential data or null if file missing/corrupt
   */
  private loadCache(): CredentialData | null {
    if (this.cache !== null) return this.cache;

    const credsPath = getCredsFile();

    if (!fs.existsSync(credsPath)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(credsPath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      this.cache = CredentialDataSchema.parse(parsed);
      this.restoreMonotonicExpiry(this.cache.expires_at);
      return this.cache;
    } catch {
      this.expiresAtMono = null;
      return null;
    }
  }
}

// ===== Module Singleton =====

let credentialStoreInstance: CredentialStore | null = null;

/**
 * Get credential store singleton
 *
 * Pattern: Singleton with explicit invalidation (same as getSettings)
 *
 * @returns CredentialStore instance (cached after first call)
 */
function getCredentialStore(): CredentialStore {
  credentialStoreInstance ??= new CredentialStore();
  return credentialStoreInstance;
}

// ===== Convenience Functions =====

/** Persist OAuth2 tokens to ~/.prompsit/credentials.json with atomic write. */
export function saveTokens(opts: TokenData): void {
  getCredentialStore().saveTokens(opts);
}

export function getAccessToken(): string | null {
  return getCredentialStore().getAccessToken();
}

export function getRefreshToken(): string | null {
  return getCredentialStore().getRefreshToken();
}

export function getAccountId(): string | null {
  return getCredentialStore().getAccountId();
}

export function clearTokens(): void {
  getCredentialStore().clearTokens();
}

export function isAuthenticated(): boolean {
  return getCredentialStore().isAuthenticated();
}

export function getPlan(): string | null {
  return getCredentialStore().getPlan();
}

export function isTokenExpired(bufferSeconds?: number): boolean {
  return getCredentialStore().isTokenExpired(bufferSeconds);
}

/** @public Used by E2E tests (terminal-setup, repl-token-refresh) — do not remove. */
export function resetAuthCache(): void {
  getCredentialStore().resetAuthCache();
}
