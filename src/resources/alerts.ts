/**
 * Alerts resource operations
 *
 * Automate's alert surface is read-only. ConnectWise's published OpenAPI
 * spec (Computers.json) exposes only GET /Alerts, GET /Alerts/{alertId} and
 * GET /Computers/{computerId}/Alerts — there is no acknowledge, close or
 * statistics route. List routes return a bare JSON array.
 */

import type { HttpClient } from '../http.js';
import type { PaginatedIterable } from '../pagination.js';
import { createPaginatedIterable } from '../pagination.js';
import { buildBaseListParams } from '../params.js';
import type { Alert, AlertListParams } from '../types/alerts.js';

/**
 * Alerts resource operations
 */
export class AlertsResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * List alerts. Narrow with `condition`, e.g. `Severity.Name = 'Critical'`.
   */
  async list(params?: AlertListParams): Promise<Alert[]> {
    return this.httpClient.request<Alert[]>('/Alerts', {
      params: buildBaseListParams(params),
    });
  }

  /**
   * List all alerts with automatic pagination
   */
  listAll(params?: Omit<AlertListParams, 'pageSize' | 'page'>): PaginatedIterable<Alert> {
    return createPaginatedIterable<Alert>(this.httpClient, '/Alerts', buildBaseListParams(params));
  }

  /**
   * Get a single alert by ID
   */
  async get(id: number): Promise<Alert> {
    return this.httpClient.request<Alert>(`/Alerts/${id}`);
  }

  /**
   * List the alerts raised against one computer
   */
  async listForComputer(computerId: number, params?: AlertListParams): Promise<Alert[]> {
    return this.httpClient.request<Alert[]>(`/Computers/${computerId}/Alerts`, {
      params: buildBaseListParams(params),
    });
  }
}
