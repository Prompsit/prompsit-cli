// See API-448, API-469, API-477, API-484, API-490, API-496: API Client facade with singleton pattern
// Composes resource instances over shared HttpTransport.
// Pattern: Module-level singleton with explicit invalidation.

import { HttpTransport } from "./transport.ts";
import { AuthSession } from "./auth-session.ts";
import { AuthResource } from "./resources/auth.ts";
import { HealthResource } from "./resources/health.ts";
import { TranslationResource } from "./resources/translation.ts";
import { EvaluationResource } from "./resources/evaluation.ts";
import { LanguagesResource } from "./resources/languages.ts";
import { DiscoveryResource } from "./resources/discovery.ts";
import { JobsResource } from "./resources/jobs.ts";
import { DataResource } from "./resources/data.ts";
import { UserResource } from "./resources/user.ts";
import { TMResource } from "./resources/tm.ts";
import { getSettings } from "../config/settings.ts";

/**
 * API Client facade composing resource instances.
 *
 * Each resource (health, auth, translate, ...) is a separate class
 * sharing the same HttpTransport for connection pooling and retry config.
 */
export class APIClient {
  private readonly transport: HttpTransport;
  public readonly baseUrl: string;
  public readonly auth: AuthResource;
  public readonly session: AuthSession;
  public readonly health: HealthResource;
  public readonly translation: TranslationResource;
  public readonly evaluation: EvaluationResource;
  public readonly languages: LanguagesResource;
  public readonly discovery: DiscoveryResource;
  public readonly jobs: JobsResource;
  public readonly data: DataResource;
  public readonly user: UserResource;
  public readonly tm: TMResource;

  constructor() {
    this.baseUrl = getSettings().api.base_url.replace(/\/{1,100}$/, "");
    this.transport = new HttpTransport();
    this.auth = new AuthResource(this.transport, this.baseUrl);
    this.session = new AuthSession(this.transport, this.auth);
    this.health = new HealthResource(this.transport, this.baseUrl);
    this.translation = new TranslationResource(this.session, this.baseUrl);
    this.evaluation = new EvaluationResource(this.session, this.baseUrl);
    this.languages = new LanguagesResource(this.session, this.baseUrl);
    this.discovery = new DiscoveryResource(this.session, this.baseUrl);
    this.jobs = new JobsResource(this.session, this.baseUrl);
    this.data = new DataResource(this.session, this.baseUrl);
    this.user = new UserResource(this.session, this.baseUrl);
    this.tm = new TMResource(this.session, this.baseUrl);
  }

  /**
   * Reset auth client (after token refresh or logout).
   */
  resetAuth(): void {
    this.transport.resetAuthClient();
  }

  /**
   * Close all connections (app shutdown).
   */
  close(): void {
    this.transport.close();
  }
}

// Module-level singleton
let cached: APIClient | null = null;

/**
 * Get API client singleton (lazy init).
 */
export function getApiClient(): APIClient {
  cached ??= new APIClient();
  return cached;
}

/**
 * Reset API client singleton (discard and recreate on next call).
 * Call after config changes or logout.
 */
export function resetApiClient(): void {
  if (cached) {
    cached.close();
    cached = null;
  }
}
