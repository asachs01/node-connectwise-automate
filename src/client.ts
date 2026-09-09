/**
 * Main ConnectWise Automate Client
 */

import type { ConnectWiseAutomateConfig, ResolvedConfig } from './config.js';
import { resolveConfig } from './config.js';
import { AuthManager } from './auth.js';
import { HttpClient } from './http.js';
import { RateLimiter } from './rate-limiter.js';
import { ComputersResource } from './resources/computers.js';
import { ClientsResource, LocationsResource } from './resources/clients.js';
import { ContactsResource } from './resources/contacts.js';
import { AlertsResource } from './resources/alerts.js';
import { ScriptsResource } from './resources/scripts.js';
import { PatchesResource } from './resources/patches.js';
import { GroupsResource } from './resources/groups.js';

/**
 * ConnectWise Automate API Client
 *
 * @example
 * ```typescript
 * // Using integrator authentication
 * const client = new ConnectWiseAutomateClient({
 *   serverUrl: 'https://your-server.hostedrmm.com',
 *   clientId: process.env.CW_AUTOMATE_CLIENT_ID!,
 *   credentials: {
 *     method: 'integrator',
 *     integratorUsername: process.env.CW_AUTOMATE_USERNAME!,
 *     integratorPassword: process.env.CW_AUTOMATE_PASSWORD!,
 *   },
 * });
 *
 * // List one page of computers (Automate returns a bare array)
 * const computers = await client.computers.list({ pageSize: 50 });
 *
 * // Get a specific computer
 * const computer = await client.computers.get(123);
 *
 * // Walk every computer with automatic pagination
 * for await (const c of client.computers.listAll({ condition: "Status = 'Online'" })) {
 *   console.log(c.ComputerName);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Using user authentication with 2FA
 * const client = new ConnectWiseAutomateClient({
 *   serverUrl: 'https://your-server.hostedrmm.com',
 *   clientId: process.env.CW_AUTOMATE_CLIENT_ID!,
 *   credentials: {
 *     method: 'user',
 *     username: process.env.CW_AUTOMATE_USERNAME!,
 *     password: process.env.CW_AUTOMATE_PASSWORD!,
 *     twoFactorCode: '123456',
 *   },
 * });
 * ```
 */
export class ConnectWiseAutomateClient {
  private readonly config: ResolvedConfig;
  private readonly authManager: AuthManager;
  private readonly rateLimiter: RateLimiter;
  private readonly httpClient: HttpClient;

  /** Computer (agent/endpoint) operations */
  readonly computers: ComputersResource;
  /** Client (company) operations */
  readonly clients: ClientsResource;
  /** Location operations */
  readonly locations: LocationsResource;
  /** Contact operations */
  readonly contacts: ContactsResource;
  /** Alert operations */
  readonly alerts: AlertsResource;
  /** Script operations */
  readonly scripts: ScriptsResource;
  /** Patch management operations */
  readonly patches: PatchesResource;
  /** Group operations */
  readonly groups: GroupsResource;

  constructor(config: ConnectWiseAutomateConfig) {
    this.config = resolveConfig(config);
    this.authManager = new AuthManager(this.config);
    this.rateLimiter = new RateLimiter(this.config.rateLimit);
    this.httpClient = new HttpClient(this.config, this.authManager, this.rateLimiter);

    // Initialize resources
    this.computers = new ComputersResource(this.httpClient);
    this.clients = new ClientsResource(this.httpClient);
    this.locations = new LocationsResource(this.httpClient);
    this.contacts = new ContactsResource(this.httpClient);
    this.alerts = new AlertsResource(this.httpClient);
    this.scripts = new ScriptsResource(this.httpClient);
    this.patches = new PatchesResource(this.httpClient);
    this.groups = new GroupsResource(this.httpClient);
  }

  /**
   * Get the current configuration
   */
  getConfig(): Readonly<ResolvedConfig> {
    return this.config;
  }

  /**
   * Invalidate the current auth token, forcing a new token to be acquired
   * on the next request
   */
  invalidateToken(): void {
    this.authManager.invalidateToken();
  }

  /**
   * Get the current rate limit status
   */
  getRateLimitStatus(): { remaining: number; rate: number } {
    return {
      remaining: this.rateLimiter.getRemainingRequests(),
      rate: this.rateLimiter.getCurrentRate(),
    };
  }
}
