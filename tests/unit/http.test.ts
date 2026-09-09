/**
 * HttpClient response-handling tests.
 *
 * Regression: connectwise-automate-mcp#54 — every API-backed tool returned an
 * empty object (200 with a non-JSON body was swallowed as `{}`), and repeat
 * calls threw "Body is unusable: Body has already been read" (the error path
 * consumed the body with response.json() and then re-read it with
 * response.text() in the catch). The body must be read exactly once.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient } from '../../src/http.js';
import { AuthManager } from '../../src/auth.js';
import { RateLimiter } from '../../src/rate-limiter.js';
import { buildBaseListParams } from '../../src/params.js';
import {
  ConnectWiseAutomateError,
  ConnectWiseAutomateNotFoundError,
  ConnectWiseAutomateServerError,
  ConnectWiseAutomateValidationError,
} from '../../src/errors.js';
import type { ResolvedConfig } from '../../src/config.js';

const config = {
  serverUrl: 'https://testserver.hostedrmm.com',
  clientId: 'test-client-id',
  credentials: {
    method: 'integrator',
    integratorUsername: 'test-user',
    integratorPassword: 'test-password',
  },
  rateLimit: { maxRequestsPerMinute: 600, maxRetries: 3, retryAfterMs: 1000 },
} as unknown as ResolvedConfig;

function makeClient(): HttpClient {
  const auth = {
    getToken: vi.fn().mockResolvedValue('test-token'),
    refreshToken: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuthManager;
  const limiter = new RateLimiter(config.rateLimit);
  return new HttpClient(config, auth, limiter);
}

/** A real Response so body semantics (one-shot stream) are exercised. */
function realResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('HttpClient response handling', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses a JSON 200 response', async () => {
    vi.mocked(fetch).mockResolvedValue(realResponse('[{"Id":1}]'));
    const result = await makeClient().request('/Clients');
    expect(result).toEqual([{ Id: 1 }]);
  });

  it('parses JSON even when the content-type header is wrong', async () => {
    vi.mocked(fetch).mockResolvedValue(
      realResponse('{"Id":7}', { headers: { 'content-type': 'text/plain' } })
    );
    const result = await makeClient().request('/Clients/7');
    expect(result).toEqual({ Id: 7 });
  });

  it('returns {} for a genuinely empty 200/204 body', async () => {
    vi.mocked(fetch).mockResolvedValue(
      realResponse('', { status: 200, headers: { 'content-type': 'text/plain' } })
    );
    const result = await makeClient().request('/Commands');
    expect(result).toEqual({});
  });

  it('throws a descriptive error (not {}) for a 200 with a non-JSON body', async () => {
    vi.mocked(fetch).mockResolvedValue(
      realResponse('<html>WAF challenge page</html>', {
        headers: { 'content-type': 'text/html' },
      })
    );
    await expect(makeClient().request('/Clients')).rejects.toThrow(
      /Expected JSON .* text\/html.*WAF challenge page/
    );
  });

  it('reads a non-JSON error body exactly once — no "Body is unusable"', async () => {
    vi.mocked(fetch).mockResolvedValue(
      realResponse('<html>gateway error</html>', {
        status: 404,
        headers: { 'content-type': 'text/html' },
      })
    );
    // Before the fix this threw TypeError "Body is unusable: Body has already
    // been read" instead of the typed not-found error carrying the real body.
    const err = await makeClient()
      .request('/Clients/999')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConnectWiseAutomateNotFoundError);
    expect((err as ConnectWiseAutomateNotFoundError).response).toContain('gateway error');
  });

  it('passes a parsed JSON error body to the typed error', async () => {
    vi.mocked(fetch).mockResolvedValue(
      realResponse('{"Message":"boom"}', { status: 503 })
    );
    // 5xx retries once, then throws — both responses must be fresh.
    vi.mocked(fetch).mockResolvedValueOnce(realResponse('{"Message":"boom"}', { status: 503 }));
    vi.mocked(fetch).mockResolvedValueOnce(realResponse('{"Message":"boom"}', { status: 503 }));
    const err = await makeClient()
      .request('/Clients')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConnectWiseAutomateServerError);
    expect((err as ConnectWiseAutomateServerError).response).toEqual({ Message: 'boom' });
  }, 15000);

  it('generic non-2xx statuses raise ConnectWiseAutomateError with the raw body', async () => {
    vi.mocked(fetch).mockResolvedValue(
      realResponse('teapot', { status: 418, headers: { 'content-type': 'text/plain' } })
    );
    const err = await makeClient()
      .request('/Clients')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConnectWiseAutomateError);
    expect((err as ConnectWiseAutomateError).response).toBe('teapot');
  });
});

/**
 * Transport contract checked against the Automate OpenAPI spec and the
 * connectwise-rest / pyconnectwise / AutomateAPI.ps1 reference clients.
 */
describe('HttpClient transport contract', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function lastCall(): { url: string; init: RequestInit } {
    const calls = vi.mocked(fetch).mock.calls;
    const call = calls[calls.length - 1] as [string, RequestInit];
    return { url: call[0], init: call[1] };
  }

  it('builds https://host/cwa/api/v1<path> with encoded query params', async () => {
    vi.mocked(fetch).mockResolvedValue(realResponse('[]'));
    await makeClient().request('/Computers', {
      params: { condition: "ComputerName like '%web%'", pageSize: 50, page: 1, skip: undefined },
    });
    const { url } = lastCall();
    expect(url).toBe(
      "https://testserver.hostedrmm.com/cwa/api/v1/Computers?condition=ComputerName+like+%27%25web%25%27&pageSize=50&page=1"
    );
  });

  it('sends the flat list query-parameter names the API actually binds', async () => {
    // The swagger names these `options.pageSize`, `options.orderBy.name`,
    // `options.includedFields`, `options.expands`, ... — but that is the C#
    // QueryOptions binder's view. Every working client (pyconnectwise
    // ConnectWiseAutomateRequestParams, AutomateAPI.ps1 Get-AutomateAPIGeneric)
    // sends the bare names below, with orderBy as one "Field asc|desc" string.
    vi.mocked(fetch).mockResolvedValue(realResponse('[]'));
    await makeClient().request('/Computers', {
      params: buildBaseListParams({
        pageSize: 50,
        page: 2,
        condition: "Status = 'Online'",
        orderBy: 'ComputerName desc',
        expand: 'Client',
        includeFields: 'Id,ComputerName',
        excludeFields: 'Comment',
        ids: '1,2',
      }),
    });
    expect(lastCall().url).toBe(
      'https://testserver.hostedrmm.com/cwa/api/v1/Computers' +
        '?pageSize=50&page=2&condition=Status+%3D+%27Online%27&orderBy=ComputerName+desc' +
        '&expand=Client&includeFields=Id%2CComputerName&excludeFields=Comment&ids=1%2C2'
    );
  });

  it('targets /cwa/api/v2 when apiVersion is v2', async () => {
    vi.mocked(fetch).mockResolvedValue(realResponse('{}'));
    await makeClient().request('/Contacts/7', { apiVersion: 'v2' });
    expect(lastCall().url).toBe('https://testserver.hostedrmm.com/cwa/api/v2/Contacts/7');
  });

  it('inserts the missing leading slash on a path', async () => {
    vi.mocked(fetch).mockResolvedValue(realResponse('[]'));
    await makeClient().request('Computers');
    expect(lastCall().url).toBe('https://testserver.hostedrmm.com/cwa/api/v1/Computers');
  });

  it('sends Authorization Bearer, ClientId, Accept and Content-Type headers', async () => {
    vi.mocked(fetch).mockResolvedValue(realResponse('[]'));
    await makeClient().request('/Computers');
    const headers = lastCall().init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-token');
    expect(headers['ClientId']).toBe('test-client-id');
    expect(headers['Accept']).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('JSON-encodes the body for POST', async () => {
    vi.mocked(fetch).mockResolvedValue(realResponse('{}'));
    await makeClient().request('/Batch/ScriptExecute', { method: 'POST', body: { EntityIds: [1] } });
    const { init } = lastCall();
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"EntityIds":[1]}');
  });

  it('maps a plain 400 to a validation error carrying the server message', async () => {
    vi.mocked(fetch).mockResolvedValue(
      realResponse('{"Message":"Invalid condition: unknown field Foo"}', { status: 400 })
    );
    const err = await makeClient()
      .request('/Computers', { params: { condition: 'Foo = 1' } })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConnectWiseAutomateValidationError);
    expect((err as Error).message).toContain('Invalid condition: unknown field Foo');
    expect((err as ConnectWiseAutomateValidationError).errors).toEqual([]);
  });

  it('maps a 400 with ModelState to field-level validation errors', async () => {
    vi.mocked(fetch).mockResolvedValue(
      realResponse('{"Message":"The request is invalid.","ModelState":{"Name":["Name is required"]}}', {
        status: 400,
      })
    );
    const err = await makeClient()
      .request('/Clients', { method: 'POST', body: {} })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConnectWiseAutomateValidationError);
    expect((err as ConnectWiseAutomateValidationError).errors).toEqual([
      { field: 'Name', message: 'Name is required' },
    ]);
  });

  it('includes the server message in a 404 error', async () => {
    vi.mocked(fetch).mockResolvedValue(realResponse('{"Message":"Computer 999 not found"}', { status: 404 }));
    const err = await makeClient()
      .request('/Computers/999')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConnectWiseAutomateNotFoundError);
    expect((err as Error).message).toContain('Computer 999 not found');
  });

  it('refreshes the token and retries once on 401', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(realResponse('{"Message":"expired"}', { status: 401 }))
      .mockResolvedValueOnce(realResponse('[{"Id":1}]'));
    const auth = {
      getToken: vi.fn().mockResolvedValueOnce('stale').mockResolvedValueOnce('fresh'),
      refreshToken: vi.fn().mockResolvedValue('fresh'),
    } as unknown as AuthManager;
    const client = new HttpClient(config, auth, new RateLimiter(config.rateLimit));

    const result = await client.request('/Computers');

    expect(result).toEqual([{ Id: 1 }]);
    expect(auth.refreshToken).toHaveBeenCalledTimes(1);
    expect((lastCall().init.headers as Record<string, string>)['Authorization']).toBe('Bearer fresh');
  });

  it('retries a GET once on 5xx', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(realResponse('{"Message":"boom"}', { status: 502 }))
      .mockResolvedValueOnce(realResponse('[{"Id":1}]'));
    const result = await makeClient().request('/Computers');
    expect(result).toEqual([{ Id: 1 }]);
    expect(fetch).toHaveBeenCalledTimes(2);
  }, 15000);

  it('does NOT retry a POST on 5xx', async () => {
    vi.mocked(fetch).mockResolvedValue(realResponse('{"Message":"boom"}', { status: 502 }));
    const err = await makeClient()
      .request('/Batch/ScriptExecute', { method: 'POST', body: {} })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConnectWiseAutomateServerError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry a PATCH on 5xx', async () => {
    vi.mocked(fetch).mockResolvedValue(realResponse('{"Message":"boom"}', { status: 500 }));
    await expect(
      makeClient().request('/Clients/1', { method: 'PATCH', body: [] })
    ).rejects.toBeInstanceOf(ConnectWiseAutomateServerError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries a GET once when fetch itself fails mid-transfer', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new TypeError('terminated'))
      .mockResolvedValueOnce(realResponse('[{"Id":1}]'));
    const result = await makeClient().request('/Computers');
    expect(result).toEqual([{ Id: 1 }]);
    expect(fetch).toHaveBeenCalledTimes(2);
  }, 15000);

  it('re-throws the raw transport error for a POST without retrying', async () => {
    const terminated = new TypeError('terminated');
    vi.mocked(fetch).mockRejectedValue(terminated);
    const err = await makeClient()
      .request('/Computers/1/CommandExecute', { method: 'POST', body: {} })
      .catch((e: unknown) => e);
    // Consumers (connectwise-automate-mcp) detect this exact error; keep it intact.
    expect(err).toBe(terminated);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries a POST on 429 because the request was never processed', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        realResponse('{"Message":"slow down"}', { status: 429, headers: { 'Retry-After': '0' } })
      )
      .mockResolvedValueOnce(realResponse('{"Ok":true}'));
    const result = await makeClient().request('/Batch/ScriptExecute', { method: 'POST', body: {} });
    expect(result).toEqual({ Ok: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
