/**
 * Pagination utilities for the ConnectWise Automate API
 *
 * Automate takes 1-based `page` / `pageSize` query parameters and returns
 * each page as a bare JSON array. There is no total count and no Link header,
 * so the only way to detect the last page is a short or empty page — which is
 * what connectwise-rest, pyconnectwise and AutomateAPI.ps1 all rely on.
 */

import type { ApiVersion, HttpClient, RequestOptions } from './http.js';
import type { ListResponse } from './types/common.js';

/**
 * Pagination parameters
 */
export interface PaginationParams {
  /** Number of records per page (default: 100) */
  pageSize?: number;
  /** Page number (1-indexed, default: 1) */
  page?: number;
}

/** Default page size. The server accepts at most 1000. */
export const DEFAULT_PAGE_SIZE = 100;

/**
 * Coerce a list response into an array.
 *
 * Automate returns a bare array. The legacy `{ Data: T[] }` envelope this
 * library used to model is still unwrapped so older fixtures keep working;
 * anything else becomes an empty list rather than a crash or an endless loop.
 */
export function normalizeListResponse<T>(raw: unknown): ListResponse<T> {
  if (Array.isArray(raw)) {
    return raw as T[];
  }
  if (typeof raw === 'object' && raw !== null) {
    const data = (raw as { Data?: unknown }).Data;
    if (Array.isArray(data)) {
      return data as T[];
    }
  }
  return [];
}

/**
 * Async iterable wrapper for paginated results
 */
export class PaginatedIterable<T> implements AsyncIterable<T> {
  private readonly httpClient: HttpClient;
  private readonly path: string;
  private readonly params: Record<string, string | number | boolean | undefined>;
  private readonly pageSize: number;
  private readonly apiVersion: ApiVersion | undefined;

  constructor(
    httpClient: HttpClient,
    path: string,
    params: Record<string, string | number | boolean | undefined> = {},
    pageSize: number = DEFAULT_PAGE_SIZE,
    apiVersion?: ApiVersion
  ) {
    this.httpClient = httpClient;
    this.path = path;
    this.params = params;
    this.pageSize = pageSize;
    this.apiVersion = apiVersion;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    for (let page = 1; ; page++) {
      const options: RequestOptions = {
        params: { ...this.params, pageSize: this.pageSize, page },
      };
      if (this.apiVersion) {
        options.apiVersion = this.apiVersion;
      }

      const items = normalizeListResponse<T>(await this.httpClient.request<unknown>(this.path, options));
      yield* items;

      // A short (or empty) page is the last one.
      if (items.length < this.pageSize) {
        break;
      }
    }
  }

  /**
   * Collect all items into an array
   */
  async toArray(): Promise<T[]> {
    const items: T[] = [];
    for await (const item of this) {
      items.push(item);
    }
    return items;
  }
}

/**
 * Build pagination query parameters
 */
export function buildPaginationParams(params?: PaginationParams): Record<string, number | undefined> {
  if (!params) {
    return {};
  }
  return {
    pageSize: params.pageSize,
    page: params.page,
  };
}

/**
 * Create a paginated iterable for a resource
 */
export function createPaginatedIterable<T>(
  httpClient: HttpClient,
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
  pageSize?: number,
  apiVersion?: ApiVersion
): PaginatedIterable<T> {
  return new PaginatedIterable<T>(httpClient, path, params, pageSize, apiVersion);
}
