/**
 * Authentication management for ConnectWise Automate API
 *
 * Both credential types — an integrator account, or a user account with
 * optional 2FA — are exchanged for a bearer token via
 * `POST /cwa/api/v1/apitoken` (`TokenCredentials` -> `TokenResult` in the
 * Automate OpenAPI spec). The token is cached and re-acquired with the stored
 * credentials shortly before `ExpirationDate`, and again after a 401. (The
 * API also offers `POST /apitoken/refresh`; re-authenticating is simpler and
 * is what pyconnectwise does.)
 */

import type { ResolvedConfig } from './config.js';
import { ConnectWiseAutomateAuthenticationError } from './errors.js';

/**
 * Token information
 */
export interface TokenInfo {
  /** Access token (JWT) */
  accessToken: string;
  /** Token type (usually 'Bearer') */
  tokenType: string;
  /** Unix timestamp (milliseconds) when the token expires */
  expiresAt: number;
}

/**
 * `Automate.Api.Domain.Contracts.Security.TokenResult`. When the account has
 * 2FA enabled and no passcode was sent, the server answers 200 with an empty
 * `AccessToken` and `IsTwoFactorRequired: true`.
 */
interface TokenResult {
  AccessToken?: string;
  TokenType?: string;
  ExpirationDate?: string;
  AbsoluteExpirationDate?: string;
  UserId?: string;
  InternalUserName?: string;
  IsTwoFactorRequired?: boolean;
  IsInternalTwoFactorRequired?: boolean;
}

/**
 * Buffer time before expiry to trigger refresh (2 minutes in milliseconds)
 */
const EXPIRY_BUFFER_MS = 2 * 60 * 1000;

/**
 * Manages authentication token lifecycle for the ConnectWise Automate API
 */
export class AuthManager {
  private readonly config: ResolvedConfig;
  private token: TokenInfo | null = null;
  private refreshPromise: Promise<TokenInfo> | null = null;

  constructor(config: ResolvedConfig) {
    this.config = config;
  }

  /**
   * Get a valid access token, acquiring or refreshing as needed
   */
  async getToken(): Promise<string> {
    // If we have a valid token that's not near expiry, return it
    if (this.token && !this.isTokenNearExpiry(this.token)) {
      return this.token.accessToken;
    }

    // If a refresh is already in progress, wait for it
    if (this.refreshPromise) {
      const token = await this.refreshPromise;
      return token.accessToken;
    }

    // Acquire a new token
    const token = await this.acquireToken();
    return token.accessToken;
  }

  /**
   * Force a token refresh (e.g., after a 401 response)
   */
  async refreshToken(): Promise<string> {
    // Clear the current token
    this.token = null;

    // If a refresh is already in progress, wait for it
    if (this.refreshPromise) {
      const token = await this.refreshPromise;
      return token.accessToken;
    }

    // Acquire a new token
    const token = await this.acquireToken();
    return token.accessToken;
  }

  /**
   * Invalidate the current token
   */
  invalidateToken(): void {
    this.token = null;
  }

  /**
   * Check if the token is valid and not near expiry
   */
  hasValidToken(): boolean {
    return this.token !== null && !this.isTokenNearExpiry(this.token);
  }

  /**
   * Acquire a new token from the API
   */
  private async acquireToken(): Promise<TokenInfo> {
    // Set up the promise to prevent concurrent requests
    this.refreshPromise = this.doAcquireToken();

    try {
      const token = await this.refreshPromise;
      this.token = token;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual token acquisition
   */
  private async doAcquireToken(): Promise<TokenInfo> {
    const tokenUrl = `${this.config.serverUrl}/cwa/api/v1/apitoken`;

    // Build the request body based on auth method
    const body = this.buildAuthBody();

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'ClientId': this.config.clientId,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new ConnectWiseAutomateAuthenticationError(
          `Failed to acquire token: ${response.status} ${response.statusText}`,
          response.status,
          errorBody
        );
      }

      const data = (await response.json()) as TokenResult;

      if (!data.AccessToken) {
        if (data.IsTwoFactorRequired) {
          throw new ConnectWiseAutomateAuthenticationError(
            'Two-factor passcode required: this account has 2FA enabled and no valid ' +
              'TwoFactorPasscode was supplied (set credentials.twoFactorCode)',
            response.status,
            data
          );
        }
        throw new ConnectWiseAutomateAuthenticationError(
          'Failed to acquire token: response contained no AccessToken',
          response.status,
          data
        );
      }

      return {
        accessToken: data.AccessToken,
        tokenType: data.TokenType || 'Bearer',
        // Missing/unparseable date -> NaN -> never treated as near expiry;
        // the 401 refresh path still covers an expired token.
        expiresAt: new Date(data.ExpirationDate ?? '').getTime(),
      };
    } catch (error) {
      if (error instanceof ConnectWiseAutomateAuthenticationError) {
        throw error;
      }
      throw new ConnectWiseAutomateAuthenticationError(
        `Failed to acquire token: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0,
        error
      );
    }
  }

  /**
   * Build the `TokenCredentials` request body based on credentials method
   */
  private buildAuthBody(): Record<string, string> {
    if (this.config.credentials.method === 'integrator') {
      return {
        UserName: this.config.credentials.integratorUsername,
        Password: this.config.credentials.integratorPassword,
      };
    }

    const body: Record<string, string> = {
      UserName: this.config.credentials.username,
      Password: this.config.credentials.password,
    };

    if (this.config.credentials.twoFactorCode) {
      // Authenticator apps display the code with a space in the middle.
      body['TwoFactorPasscode'] = this.config.credentials.twoFactorCode.replace(/\s/g, '');
    }

    return body;
  }

  /**
   * Check if a token is within the expiry buffer
   */
  private isTokenNearExpiry(token: TokenInfo): boolean {
    return Date.now() >= token.expiresAt - EXPIRY_BUFFER_MS;
  }
}
