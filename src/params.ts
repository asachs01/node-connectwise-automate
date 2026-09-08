/**
 * Query-parameter and request-body construction for the ConnectWise Automate API.
 *
 * Automate does NOT use OData-style `$select`/`$orderby`/`$expand` — those
 * belong to ConnectWise Manage. Automate takes plain camelCase names, and its
 * filter parameter is `condition` (singular, unlike Manage's `conditions`).
 */

import type { BaseListParams, PatchOperation } from './types/common.js';

/** Query parameters accepted by every Automate list endpoint. */
export type QueryParams = Record<string, string | number | boolean | undefined>;

/**
 * Map the shared list params onto Automate's real query-parameter names.
 */
export function buildBaseListParams(params?: BaseListParams): QueryParams {
  if (!params) return {};

  const result: QueryParams = {};

  if (params.pageSize !== undefined) result['pageSize'] = params.pageSize;
  if (params.page !== undefined) result['page'] = params.page;
  if (params.condition !== undefined) result['condition'] = params.condition;
  if (params.orderBy !== undefined) result['orderBy'] = params.orderBy;
  if (params.expand !== undefined) result['expand'] = params.expand;
  if (params.includeFields !== undefined) {
    result['includeFields'] = params.includeFields;
  }
  if (params.excludeFields !== undefined) {
    result['excludeFields'] = params.excludeFields;
  }
  if (params.ids !== undefined) result['ids'] = params.ids;

  return result;
}

/**
 * Convert a partial entity into the JSON-Patch operation array Automate's
 * PATCH routes require: one `replace` per defined key, with Path `/<Key>`.
 * `undefined` values are skipped; `null` is sent as an explicit clear.
 */
export function toPatchOperations(data: Record<string, unknown>): PatchOperation[] {
  return Object.entries(data)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]): PatchOperation => ({ Op: 'replace', Path: `/${key}`, Value: value }));
}
