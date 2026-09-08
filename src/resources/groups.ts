/**
 * Groups resource.
 *
 * Routes verified against the Automate v1 OpenAPI spec (Groups.json):
 *
 *   GET/POST              /Groups
 *   GET/PUT/PATCH/DELETE  /Groups/{entityId}
 *   GET/POST              /GroupComputers
 *   GET/PUT/PATCH/DELETE  /GroupComputers/{entityId}
 *
 * There is no `/Groups/{id}/Members` route. Computer membership is the
 * separate `/GroupComputers` collection, filtered with a `GroupId = N`
 * condition. List routes return bare arrays.
 */

import type { HttpClient } from '../http.js';
import type { PaginatedIterable } from '../pagination.js';
import { createPaginatedIterable } from '../pagination.js';
import type { QueryParams } from '../params.js';
import { buildBaseListParams } from '../params.js';
import type {
  Group,
  GroupListParams,
  GroupListResponse,
  GroupComputer,
  GroupComputerListParams,
  GroupComputerListResponse,
} from '../types/groups.js';

/**
 * Groups resource operations
 */
export class GroupsResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * List groups. Filter with `condition`, e.g. `ParentId = 3`.
   */
  async list(params?: GroupListParams): Promise<GroupListResponse> {
    return this.httpClient.request<GroupListResponse>('/Groups', {
      params: buildBaseListParams(params),
    });
  }

  /**
   * List all groups with automatic pagination
   */
  listAll(params?: Omit<GroupListParams, 'pageSize' | 'page'>): PaginatedIterable<Group> {
    return createPaginatedIterable<Group>(this.httpClient, '/Groups', buildBaseListParams(params));
  }

  /**
   * Get a single group by ID
   */
  async get(id: number): Promise<Group> {
    return this.httpClient.request<Group>(`/Groups/${id}`);
  }

  /**
   * List the computer memberships of a group
   */
  async computers(groupId: number, params?: GroupComputerListParams): Promise<GroupComputerListResponse> {
    return this.httpClient.request<GroupComputerListResponse>('/GroupComputers', {
      params: this.buildMembershipParams(groupId, params),
    });
  }

  /**
   * List all computer memberships of a group with automatic pagination
   */
  computersAll(
    groupId: number,
    params?: Omit<GroupComputerListParams, 'pageSize' | 'page'>
  ): PaginatedIterable<GroupComputer> {
    return createPaginatedIterable<GroupComputer>(
      this.httpClient,
      '/GroupComputers',
      this.buildMembershipParams(groupId, params)
    );
  }

  /**
   * Add a computer to a group
   */
  async addComputer(groupId: number, computerId: number): Promise<GroupComputer> {
    return this.httpClient.request<GroupComputer>('/GroupComputers', {
      method: 'POST',
      body: { GroupId: groupId, ComputerId: computerId },
    });
  }

  /**
   * Remove a computer from a group. `membershipId` is the `Id` of the
   * `GroupComputer` row, as returned by `computers()` or `addComputer()`.
   */
  async removeComputer(membershipId: string): Promise<void> {
    await this.httpClient.request<void>(`/GroupComputers/${membershipId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Scope a `/GroupComputers` query to one group via `condition`.
   */
  private buildMembershipParams(groupId: number, params?: GroupComputerListParams): QueryParams {
    const query = buildBaseListParams(params);
    const clause = `GroupId = ${groupId}`;
    query['condition'] = params?.condition ? `(${params.condition}) and (${clause})` : clause;
    return query;
  }
}
