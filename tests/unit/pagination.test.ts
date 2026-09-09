/**
 * Pagination tests.
 *
 * ConnectWise Automate list endpoints return a bare JSON array (every GET in
 * the published OpenAPI spec is typed `array`; there is no TotalRecords/Data
 * envelope anywhere). The iterable must page through bare arrays and stop on
 * an empty or short page without an extra request.
 */

import { describe, it, expect, vi } from 'vitest';
import { createPaginatedIterable, normalizeListResponse } from '../../src/pagination.js';
import type { HttpClient } from '../../src/http.js';

type Row = { Id: number };

function fakeHttp(pages: unknown[]): { http: HttpClient; calls: Array<Record<string, unknown>> } {
  const calls: Array<Record<string, unknown>> = [];
  const request = vi.fn(async (_path: string, options: Record<string, unknown> = {}) => {
    calls.push(options);
    const page = Number((options['params'] as Record<string, unknown>)['page']);
    return pages[page - 1] ?? [];
  });
  return { http: { request } as unknown as HttpClient, calls };
}

describe('normalizeListResponse', () => {
  it('returns a bare array unchanged', () => {
    const rows = [{ Id: 1 }, { Id: 2 }];
    expect(normalizeListResponse<Row>(rows)).toBe(rows);
  });

  it('unwraps the legacy { Data } envelope', () => {
    expect(normalizeListResponse<Row>({ TotalRecords: 2, Data: [{ Id: 1 }] })).toEqual([{ Id: 1 }]);
  });

  it('returns an empty array for null, undefined, or a non-list object', () => {
    expect(normalizeListResponse<Row>(null)).toEqual([]);
    expect(normalizeListResponse<Row>(undefined)).toEqual([]);
    expect(normalizeListResponse<Row>({})).toEqual([]);
    expect(normalizeListResponse<Row>({ Data: 'nope' })).toEqual([]);
  });
});

describe('PaginatedIterable', () => {
  it('pages through bare arrays and stops on a short page', async () => {
    const { http, calls } = fakeHttp([
      [{ Id: 1 }, { Id: 2 }],
      [{ Id: 3 }],
    ]);
    const rows = await createPaginatedIterable<Row>(http, '/Computers', { condition: 'x' }, 2).toArray();

    expect(rows.map(r => r.Id)).toEqual([1, 2, 3]);
    // Page 2 was short, so no third request.
    expect(calls).toHaveLength(2);
    expect(calls[0]?.['params']).toEqual({ condition: 'x', pageSize: 2, page: 1 });
    expect(calls[1]?.['params']).toEqual({ condition: 'x', pageSize: 2, page: 2 });
  });

  it('stops on an empty page when the last page was full', async () => {
    const { http, calls } = fakeHttp([
      [{ Id: 1 }, { Id: 2 }],
      [],
    ]);
    const rows = await createPaginatedIterable<Row>(http, '/Computers', {}, 2).toArray();

    expect(rows).toHaveLength(2);
    expect(calls).toHaveLength(2);
  });

  it('yields nothing and makes one request for an empty first page', async () => {
    const { http, calls } = fakeHttp([[]]);
    const rows = await createPaginatedIterable<Row>(http, '/Computers').toArray();

    expect(rows).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('still accepts the legacy { Data } envelope', async () => {
    const { http } = fakeHttp([{ TotalRecords: 1, Data: [{ Id: 9 }] }]);
    const rows = await createPaginatedIterable<Row>(http, '/Computers').toArray();

    expect(rows).toEqual([{ Id: 9 }]);
  });

  it('does not loop forever on a non-list response', async () => {
    const { http, calls } = fakeHttp([{ Message: 'unexpected' }]);
    const rows = await createPaginatedIterable<Row>(http, '/Computers').toArray();

    expect(rows).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('defaults to pageSize 100 and page 1', async () => {
    const { http, calls } = fakeHttp([[{ Id: 1 }]]);
    await createPaginatedIterable<Row>(http, '/Computers').toArray();

    expect(calls[0]?.['params']).toEqual({ pageSize: 100, page: 1 });
  });

  it('passes apiVersion through to every page request', async () => {
    const { http, calls } = fakeHttp([[{ Id: 1 }, { Id: 2 }], [{ Id: 3 }]]);
    await createPaginatedIterable<Row>(http, '/Contacts', {}, 2, 'v2').toArray();

    expect(calls.every(c => c['apiVersion'] === 'v2')).toBe(true);
  });
});
