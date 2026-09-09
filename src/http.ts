/**
 * HTTP layer for the ConnectWise Automate API
 *
 * Requests go to `https://<host>/cwa/api/<version><path>` — the prefix that
 * connectwise-rest, pyconnectwise and AutomateAPI.ps1 all use. Almost every
 * route lives under v1; a few (Contacts, some Scripts routes) exist only
 * under v2.
 */

import type { ResolvedConfig } from './config.js';
import type { AuthManager } from './auth.js';
import type { RateLimiter } from './rate-limiter.js';
import {
  ConnectWiseAutomateError,
  ConnectWiseAutomateAuthenticationError,
  ConnectWiseAutomateForbiddenError,
  ConnectWiseAutomateNotFoundError,
  ConnectWiseAutomateValidationError,
  ConnectWiseAutomateRateLimitError,
  ConnectWiseAutomateServerError,
} from './errors.js';

/** API version path segment */
export type ApiVersion = 'v1' | 'v2';

/** HTTP methods used by the API */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * HTTP request options
 */
export interface RequestOptions {
  /** HTTP method */
  method?: HttpMethod;
  /** Request body (will be JSON stringified) */
  body?: unknown;
  /** URL query parameters */
  params?: Record<string, string | number | boolean | undefined>;
  /** API version segment (default: 'v1') */
  apiVersion?: ApiVersion;
  /** Skip authentication (for token endpoint) */
  skipAuth?: boolean;
}

/**
 * Methods whose requests can safely be re-sent after a 5xx or a dropped
 * connection (RFC 9110 §9.2.2). POST and PATCH are never retried: a script
 * launch or command that did reach the server would otherwise run twice.
 */
const IDEMPOTENT_METHODS: ReadonlySet<string> = new Set(['GET', 'PUT', 'DELETE']);

/** Pause before re-sending an idempotent request after a 5xx or transport failure */
const SERVER_ERROR_RETRY_DELAY_MS = 1000;

/**
 * HTTP client for making authenticated requests to the ConnectWise Automate API
 */
export class HttpClient {
  private readonly config: ResolvedConfig;
  private readonly authManager: AuthManager;
  private readonly rateLimiter: RateLimiter;

  constructor(config: ResolvedConfig, authManager: AuthManager, rateLimiter: RateLimiter) {
    this.config = config;
    this.authManager = authManager;
    this.rateLimiter = rateLimiter;
  }

  /**
   * Make an authenticated request to the API
   */
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, params, apiVersion = 'v1', skipAuth = false } = options;
    const url = this.buildUrl(path, apiVersion, params);
    return this.executeRequest<T>(url, method, body, skipAuth);
  }

  /**
   * Make a request to a full URL (for pagination)
   */
  async requestUrl<T>(url: string): Promise<T> {
    return this.executeRequest<T>(url, 'GET', undefined, false);
  }

  /**
   * Build the absolute URL for a resource path
   */
  private buildUrl(
    path: string,
    apiVersion: ApiVersion,
    params: RequestOptions['params']
  ): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    let url = `${this.config.serverUrl}/cwa/api/${apiVersion}${normalizedPath}`;

    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      }
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    return url;
  }

  /**
   * Execute the request with retry logic
   */
  private async executeRequest<T>(
    url: string,
    method: string,
    body: unknown,
    skipAuth: boolean,
    retryCount: number = 0,
    isRetryAfter401: boolean = false
  ): Promise<T> {
    // Wait for a rate limit slot
    await this.rateLimiter.waitForSlot();

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'ClientId': this.config.clientId,
    };

    if (!skipAuth) {
      const token = await this.authManager.getToken();
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Record the request
    this.rateLimiter.recordRequest();

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      // No response at all: DNS failure, connection reset, or the socket
      // closed mid-transfer (undici's `TypeError: terminated`). Re-send once
      // for idempotent methods; otherwise surface the raw error untouched so
      // callers can classify it themselves.
      if (this.canRetry(method, retryCount)) {
        await this.sleep(SERVER_ERROR_RETRY_DELAY_MS);
        return this.executeRequest<T>(url, method, body, skipAuth, retryCount + 1, isRetryAfter401);
      }
      throw error;
    }

    return this.handleResponse<T>(response, url, method, body, skipAuth, retryCount, isRetryAfter401);
  }

  /**
   * Handle the response and errors
   */
  private async handleResponse<T>(
    response: Response,
    url: string,
    method: string,
    body: unknown,
    skipAuth: boolean,
    retryCount: number,
    isRetryAfter401: boolean
  ): Promise<T> {
    // Read the body EXACTLY once, as text, for every path. A fetch Response
    // body is a one-shot stream: response.json() followed by response.text()
    // in a catch throws "Body is unusable: Body has already been read",
    // which masked the real (often non-JSON, e.g. WAF/proxy HTML) response
    // on hosted Automate instances (connectwise-automate-mcp#54).
    const rawBody = await response.text();
    let parsedBody: unknown;
    let bodyIsJson = false;
    try {
      parsedBody = JSON.parse(rawBody);
      bodyIsJson = true;
    } catch {
      parsedBody = rawBody;
    }

    if (response.ok) {
      if (bodyIsJson) {
        return parsedBody as T;
      }
      if (rawBody.trim() === '') {
        // Genuinely empty 200/204 — preserve the historical empty-object shape.
        return {} as T;
      }
      // A 200 whose body isn't JSON is not a success we can use (login pages,
      // WAF challenges, proxy errors). Surfacing it beats returning {} and
      // letting the caller believe the API answered.
      throw new ConnectWiseAutomateError(
        `Expected JSON from ${method} ${url} but got ${
          response.headers.get('content-type') ?? 'no content-type'
        }: ${rawBody.slice(0, 200)}`,
        response.status,
        rawBody.slice(0, 2000)
      );
    }

    const serverMessage = this.extractServerMessage(parsedBody);
    const describe = (summary: string): string =>
      serverMessage ? `${summary}: ${serverMessage}` : summary;

    switch (response.status) {
      case 400:
        // Malformed request: bad `condition`, unbindable body, model errors.
        // (Bad credentials never reach here — the token endpoint is handled
        // by AuthManager.)
        throw new ConnectWiseAutomateValidationError(
          describe('Bad request'),
          this.parseValidationErrors(parsedBody),
          parsedBody
        );

      case 401:
        // If this is already a retry after 401, don't retry again
        if (isRetryAfter401) {
          throw new ConnectWiseAutomateAuthenticationError(
            describe('Authentication failed after token refresh'),
            401,
            parsedBody
          );
        }
        // Try to refresh the token and retry once
        await this.authManager.refreshToken();
        return this.executeRequest<T>(url, method, body, skipAuth, retryCount, true);

      case 403:
        throw new ConnectWiseAutomateForbiddenError(
          describe('Access forbidden - insufficient permissions'),
          parsedBody
        );

      case 404:
        throw new ConnectWiseAutomateNotFoundError(describe('Resource not found'), parsedBody);

      case 429:
        // Rate limited: the request was not processed, so any method is safe to retry.
        if (this.rateLimiter.shouldRetry(retryCount)) {
          const retryAfterHeader = response.headers.get('Retry-After');
          const delay = this.rateLimiter.parseRetryAfter(retryAfterHeader);
          this.rateLimiter.handleRateLimitError(retryCount);
          await this.sleep(delay);
          return this.executeRequest<T>(url, method, body, skipAuth, retryCount + 1, isRetryAfter401);
        }
        throw new ConnectWiseAutomateRateLimitError(
          describe('Rate limit exceeded and max retries reached'),
          this.config.rateLimit.retryAfterMs,
          parsedBody
        );

      default:
        if (response.status >= 500) {
          if (this.canRetry(method, retryCount)) {
            await this.sleep(SERVER_ERROR_RETRY_DELAY_MS);
            return this.executeRequest<T>(url, method, body, skipAuth, retryCount + 1, isRetryAfter401);
          }
          throw new ConnectWiseAutomateServerError(
            describe(`Server error: ${response.status} ${response.statusText}`),
            response.status,
            parsedBody
          );
        }
        throw new ConnectWiseAutomateError(
          describe(`Request failed: ${response.status} ${response.statusText}`),
          response.status,
          parsedBody
        );
    }
  }

  /**
   * Whether a failed request may be re-sent: only idempotent methods, once.
   */
  private canRetry(method: string, retryCount: number): boolean {
    return IDEMPOTENT_METHODS.has(method) && retryCount === 0;
  }

  /**
   * Pull the human-readable message out of an ASP.NET style error body
   * (`{ "Message": "..." }`), if there is one.
   */
  private extractServerMessage(responseBody: unknown): string | undefined {
    if (typeof responseBody !== 'object' || responseBody === null) {
      return undefined;
    }
    const body = responseBody as Record<string, unknown>;
    const message = body['Message'] ?? body['message'];
    return typeof message === 'string' && message.trim() !== '' ? message : undefined;
  }

  /**
   * Parse field-level validation errors from a response body
   * (ASP.NET `ModelState`, or an `Errors` array). Empty when there are none.
   */
  private parseValidationErrors(responseBody: unknown): Array<{ field: string; message: string }> {
    if (typeof responseBody === 'object' && responseBody !== null) {
      const body = responseBody as Record<string, unknown>;

      // Handle ModelState format (common in .NET APIs)
      if (typeof body['ModelState'] === 'object' && body['ModelState'] !== null) {
        const modelState = body['ModelState'] as Record<string, string[]>;
        const errors: Array<{ field: string; message: string }> = [];
        for (const [field, messages] of Object.entries(modelState)) {
          if (Array.isArray(messages)) {
            for (const message of messages) {
              errors.push({ field, message: String(message) });
            }
          }
        }
        return errors;
      }

      // Handle Errors array format
      const errorArray = (body['Errors'] ?? body['errors']) as unknown;
      if (Array.isArray(errorArray)) {
        return errorArray.map((err: unknown) => {
          if (typeof err === 'object' && err !== null) {
            const e = err as Record<string, unknown>;
            return {
              field: String(e['field'] ?? e['Field'] ?? e['property'] ?? 'unknown'),
              message: String(e['message'] ?? e['Message'] ?? e['error'] ?? 'Unknown error'),
            };
          }
          return { field: 'unknown', message: String(err) };
        });
      }
    }
    return [];
  }

  /**
   * Sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
