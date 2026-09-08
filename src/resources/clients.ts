/**
 * Clients (companies) and Locations resources.
 *
 * Routes verified against the Automate v1 OpenAPI spec (Company.json and
 * Computers.json):
 *
 *   GET/POST              /Clients
 *   GET/PUT/PATCH/DELETE  /Clients/{clientId}
 *   GET/POST              /Locations
 *   GET/PUT/PATCH/DELETE  /Locations/{locationId}
 *
 * List routes return bare arrays and take only the shared list options —
 * there is no `clientId`, `name` or `includeInactive` query parameter, and
 * Automate silently ignores unknown parameters. PATCH routes take a JSON
 * Patch operation array, not a partial entity.
 */

import type { HttpClient } from '../http.js';
import type { PaginatedIterable } from '../pagination.js';
import { createPaginatedIterable } from '../pagination.js';
import type { QueryParams } from '../params.js';
import { buildBaseListParams, toPatchOperations } from '../params.js';
import type {
  Client,
  ClientListParams,
  ClientListResponse,
  ClientCreateData,
  ClientUpdateData,
  Location,
  LocationListParams,
  LocationListResponse,
  LocationCreateData,
  LocationUpdateData,
} from '../types/clients.js';

/**
 * Clients resource operations
 */
export class ClientsResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * List clients. Filter with `condition`, e.g. `Name like '%acme%'`.
   */
  async list(params?: ClientListParams): Promise<ClientListResponse> {
    return this.httpClient.request<ClientListResponse>('/Clients', {
      params: buildBaseListParams(params),
    });
  }

  /**
   * List all clients with automatic pagination
   */
  listAll(params?: Omit<ClientListParams, 'pageSize' | 'page'>): PaginatedIterable<Client> {
    return createPaginatedIterable<Client>(this.httpClient, '/Clients', buildBaseListParams(params));
  }

  /**
   * Get a single client by ID
   */
  async get(id: number): Promise<Client> {
    return this.httpClient.request<Client>(`/Clients/${id}`);
  }

  /**
   * Create a new client
   */
  async create(data: ClientCreateData): Promise<Client> {
    return this.httpClient.request<Client>('/Clients', {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Update a client. Each defined field is sent as a JSON Patch `replace`
   * operation, which is what `PATCH /Clients/{id}` accepts.
   */
  async update(id: number, data: ClientUpdateData): Promise<Client> {
    return this.httpClient.request<Client>(`/Clients/${id}`, {
      method: 'PATCH',
      body: toPatchOperations(data),
    });
  }

  /**
   * Delete a client
   */
  async delete(id: number): Promise<void> {
    await this.httpClient.request<void>(`/Clients/${id}`, {
      method: 'DELETE',
    });
  }
}

/**
 * Locations resource operations
 */
export class LocationsResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * List locations. `clientId` restricts results to one client; anything
   * else goes through `condition`.
   */
  async list(params?: LocationListParams): Promise<LocationListResponse> {
    return this.httpClient.request<LocationListResponse>('/Locations', {
      params: this.buildListParams(params),
    });
  }

  /**
   * List all locations with automatic pagination
   */
  listAll(params?: Omit<LocationListParams, 'pageSize' | 'page'>): PaginatedIterable<Location> {
    return createPaginatedIterable<Location>(this.httpClient, '/Locations', this.buildListParams(params));
  }

  /**
   * Get a single location by ID
   */
  async get(id: number): Promise<Location> {
    return this.httpClient.request<Location>(`/Locations/${id}`);
  }

  /**
   * Create a new location under `data.Client.Id`
   */
  async create(data: LocationCreateData): Promise<Location> {
    return this.httpClient.request<Location>('/Locations', {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Update a location. Each defined field is sent as a JSON Patch `replace`
   * operation, which is what `PATCH /Locations/{id}` accepts.
   */
  async update(id: number, data: LocationUpdateData): Promise<Location> {
    return this.httpClient.request<Location>(`/Locations/${id}`, {
      method: 'PATCH',
      body: toPatchOperations(data),
    });
  }

  /**
   * Delete a location
   */
  async delete(id: number): Promise<void> {
    await this.httpClient.request<void>(`/Locations/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Map list params onto the query string. Automate has no `clientId`
   * parameter on `/Locations`, so it becomes a `Client.Id = N` condition.
   */
  private buildListParams(params?: LocationListParams): QueryParams {
    const query = buildBaseListParams(params);
    if (params?.clientId !== undefined) {
      const clause = `Client.Id = ${params.clientId}`;
      query['condition'] = params.condition ? `(${params.condition}) and (${clause})` : clause;
    }
    return query;
  }
}
