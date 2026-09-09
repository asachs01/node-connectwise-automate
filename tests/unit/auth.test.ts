/**
 * Auth manager tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { AuthManager } from '../../src/auth.js';
import { resolveConfig } from '../../src/config.js';
import { ConnectWiseAutomateAuthenticationError } from '../../src/errors.js';
import { server } from '../mocks/server.js';
import * as fixtures from '../fixtures/index.js';

describe('AuthManager', () => {
  const createAuthManager = (overrides: Partial<{ integratorUsername: string; integratorPassword: string }> = {}) => {
    const config = resolveConfig({
      serverUrl: 'https://testserver.hostedrmm.com',
      clientId: 'test-client-id',
      credentials: {
        method: 'integrator',
        integratorUsername: overrides.integratorUsername ?? 'test-user',
        integratorPassword: overrides.integratorPassword ?? 'test-password',
      },
    });
    return new AuthManager(config);
  };

  describe('getToken', () => {
    it('should acquire a new token', async () => {
      const authManager = createAuthManager();
      const token = await authManager.getToken();

      expect(token).toBe('mock-jwt-token-for-testing');
    });

    it('should return cached token on subsequent calls', async () => {
      const authManager = createAuthManager();

      const token1 = await authManager.getToken();
      const token2 = await authManager.getToken();

      expect(token1).toBe(token2);
    });

    it('should throw on bad credentials', async () => {
      const authManager = createAuthManager({
        integratorUsername: 'bad-user',
        integratorPassword: 'bad-password',
      });

      await expect(authManager.getToken()).rejects.toThrow(ConnectWiseAutomateAuthenticationError);
    });
  });

  describe('refreshToken', () => {
    let authManager: AuthManager;

    beforeEach(() => {
      authManager = createAuthManager();
    });

    it('should acquire a new token', async () => {
      // First get a token
      await authManager.getToken();

      // Then refresh
      const token = await authManager.refreshToken();

      expect(token).toBe('mock-jwt-token-for-testing');
    });
  });

  describe('invalidateToken', () => {
    it('should clear the cached token', async () => {
      const authManager = createAuthManager();

      // First get a token
      await authManager.getToken();
      expect(authManager.hasValidToken()).toBe(true);

      // Invalidate
      authManager.invalidateToken();
      expect(authManager.hasValidToken()).toBe(false);
    });
  });

  describe('hasValidToken', () => {
    it('should return false when no token', () => {
      const authManager = createAuthManager();
      expect(authManager.hasValidToken()).toBe(false);
    });

    it('should return true after acquiring token', async () => {
      const authManager = createAuthManager();
      await authManager.getToken();
      expect(authManager.hasValidToken()).toBe(true);
    });
  });
});

/**
 * Token-endpoint contract, checked against System.json (POST /api/v1/APIToken,
 * TokenCredentials -> TokenResult) and the reference clients.
 */
describe('AuthManager token request', () => {
  const TOKEN_URL = 'https://testserver.hostedrmm.com/cwa/api/v1/apitoken';

  function captureTokenRequest(reply: Record<string, unknown> = fixtures.auth.tokenSuccess) {
    const seen: { body?: Record<string, unknown>; headers?: Headers; count: number } = { count: 0 };
    server.use(
      http.post(TOKEN_URL, async ({ request }) => {
        seen.count += 1;
        seen.headers = request.headers;
        seen.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(reply);
      })
    );
    return seen;
  }

  it('posts UserName/Password with ClientId, Content-Type and Accept headers', async () => {
    const seen = captureTokenRequest();
    const authManager = new AuthManager(
      resolveConfig({
        serverUrl: 'https://testserver.hostedrmm.com',
        clientId: 'test-client-id',
        credentials: { method: 'integrator', integratorUsername: 'u', integratorPassword: 'p' },
      })
    );

    await authManager.getToken();

    expect(seen.body).toEqual({ UserName: 'u', Password: 'p' });
    expect(seen.headers?.get('clientid')).toBe('test-client-id');
    expect(seen.headers?.get('content-type')).toBe('application/json');
    expect(seen.headers?.get('accept')).toBe('application/json');
    expect(seen.headers?.get('authorization')).toBeNull();
  });

  it('adds TwoFactorPasscode for user credentials with a 2FA code', async () => {
    const seen = captureTokenRequest();
    const authManager = new AuthManager(
      resolveConfig({
        serverUrl: 'https://testserver.hostedrmm.com',
        clientId: 'test-client-id',
        credentials: { method: 'user', username: 'u', password: 'p', twoFactorCode: '123 456' },
      })
    );

    await authManager.getToken();

    expect(seen.body).toEqual({ UserName: 'u', Password: 'p', TwoFactorPasscode: '123456' });
  });

  it('throws a clear error when the server demands a two-factor passcode', async () => {
    captureTokenRequest({ AccessToken: '', IsTwoFactorRequired: true, ExpirationDate: '0001-01-01T00:00:00' });
    const authManager = new AuthManager(
      resolveConfig({
        serverUrl: 'https://testserver.hostedrmm.com',
        clientId: 'test-client-id',
        credentials: { method: 'user', username: 'u', password: 'p' },
      })
    );

    await expect(authManager.getToken()).rejects.toThrow(/two-factor/i);
    await expect(authManager.getToken()).rejects.toThrow(ConnectWiseAutomateAuthenticationError);
    expect(authManager.hasValidToken()).toBe(false);
  });

  it('throws when a 200 token response carries no AccessToken', async () => {
    captureTokenRequest({ TokenType: 'Bearer' });
    const authManager = new AuthManager(
      resolveConfig({
        serverUrl: 'https://testserver.hostedrmm.com',
        clientId: 'test-client-id',
        credentials: { method: 'integrator', integratorUsername: 'u', integratorPassword: 'p' },
      })
    );

    await expect(authManager.getToken()).rejects.toThrow(ConnectWiseAutomateAuthenticationError);
  });

  it('re-authenticates when the cached token is within the expiry buffer', async () => {
    const seen = captureTokenRequest({
      ...fixtures.auth.tokenSuccess,
      ExpirationDate: new Date(Date.now() + 60_000).toISOString(),
    });
    const authManager = new AuthManager(
      resolveConfig({
        serverUrl: 'https://testserver.hostedrmm.com',
        clientId: 'test-client-id',
        credentials: { method: 'integrator', integratorUsername: 'u', integratorPassword: 'p' },
      })
    );

    await authManager.getToken();
    await authManager.getToken();

    expect(seen.count).toBe(2);
    expect(authManager.hasValidToken()).toBe(false);
  });

  it('coalesces concurrent token requests into one round trip', async () => {
    const seen = captureTokenRequest();
    const authManager = new AuthManager(
      resolveConfig({
        serverUrl: 'https://testserver.hostedrmm.com',
        clientId: 'test-client-id',
        credentials: { method: 'integrator', integratorUsername: 'u', integratorPassword: 'p' },
      })
    );

    const tokens = await Promise.all([authManager.getToken(), authManager.getToken(), authManager.getToken()]);

    expect(new Set(tokens).size).toBe(1);
    expect(seen.count).toBe(1);
  });
});
