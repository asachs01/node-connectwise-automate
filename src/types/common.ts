/**
 * Common types shared across resources
 */

/**
 * Base list parameters for paginated endpoints.
 *
 * These are the flat query-parameter names the Automate API binds
 * (`?condition=...&orderBy=...&pageSize=...&page=...`), the same ones
 * pyconnectwise and the AutomateAPI PowerShell module send.
 */
export interface BaseListParams {
  /** Number of records per page (default: 100; the server accepts at most 1000) */
  pageSize?: number;
  /** Page number (1-indexed, default: 1) */
  page?: number;
  /**
   * Automate filter expression, e.g. `ComputerName like '%web%'`.
   * Operators: `=`/`eq`, `!=`, `>`, `>=`, `<`, `<=`, `and`, `or`, `()`, `like`,
   * `contains`, `in`, `not`. String values are single- or double-quoted;
   * booleans are `true`/`false`.
   */
  condition?: string;
  /** Comma-separated fields to include in the response */
  includeFields?: string;
  /** Comma-separated fields to omit from the response */
  excludeFields?: string;
  /** Sort field and direction, e.g. `ComputerName asc` or `LastContact desc` */
  orderBy?: string;
  /** Expand related entities */
  expand?: string;
  /** Comma-separated list of ids to fetch */
  ids?: string;
}

/**
 * Base entity with common fields
 */
export interface BaseEntity {
  Id: number;
}

/**
 * Shape of an Automate list response.
 *
 * Every list route in the Automate OpenAPI spec returns a bare JSON array.
 * There is no `{ TotalRecords, Data }` envelope and no total-count header;
 * use `pageSize`/`page` (or a resource's `listAll()`) to walk the full set.
 */
export type ListResponse<T> = T[];

/**
 * Extra data fields for computers
 */
export interface ExtraDataField {
  Id: number;
  FieldName: string;
  FieldValue: string;
}

/**
 * Location information
 */
export interface LocationInfo {
  Id: number;
  Name: string;
  ClientId: number;
}

/**
 * A JSON-Patch style operation. Automate PATCH routes take an array of these
 * (`LabTech.RESTApi.Models.PatchOperationArray` in the spec), not a partial
 * entity. Build them with `toPatchOperations()`.
 */
export interface PatchOperation {
  Op: 'add' | 'replace' | 'remove';
  /** JSON pointer to the field, e.g. `/Name` */
  Path: string;
  Value?: unknown;
}

/**
 * Generic API response
 */
export interface ApiResponse<T> {
  Data: T;
  Success: boolean;
  Message?: string;
}
