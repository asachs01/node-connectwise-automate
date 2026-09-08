/**
 * Contacts resource.
 *
 * Contacts live on the **v2** API. The v1 API has only a read-only
 * `GET /api/v1/Contacts`; per the Automate OpenAPI spec (Contacts.json) the
 * routes below exist solely under `/api/v2`:
 *
 *   GET/POST         /api/v2/Contacts
 *   GET/PUT/DELETE   /api/v2/Contacts/{contactId}
 *
 * There is no PATCH: an update is a full PUT replacement. The list route
 * returns a bare array and takes only the shared list options.
 */

import type { HttpClient } from '../http.js';
import type { PaginatedIterable } from '../pagination.js';
import { createPaginatedIterable } from '../pagination.js';
import { buildBaseListParams } from '../params.js';
import type {
  Contact,
  ContactListParams,
  ContactListResponse,
  ContactCreateData,
  ContactUpdateData,
} from '../types/contacts.js';

/**
 * Contacts resource operations
 */
export class ContactsResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * List contacts. Filter with `condition`.
   */
  async list(params?: ContactListParams): Promise<ContactListResponse> {
    return this.httpClient.request<ContactListResponse>('/Contacts', {
      params: buildBaseListParams(params),
      apiVersion: 'v2',
    });
  }

  /**
   * List all contacts with automatic pagination
   */
  listAll(params?: Omit<ContactListParams, 'pageSize' | 'page'>): PaginatedIterable<Contact> {
    return createPaginatedIterable<Contact>(
      this.httpClient,
      '/Contacts',
      buildBaseListParams(params),
      undefined,
      'v2'
    );
  }

  /**
   * Get a single contact by ID
   */
  async get(id: number): Promise<Contact> {
    return this.httpClient.request<Contact>(`/Contacts/${id}`, { apiVersion: 'v2' });
  }

  /**
   * Create a new contact under `data.Client.ClientId`
   */
  async create(data: ContactCreateData): Promise<Contact> {
    return this.httpClient.request<Contact>('/Contacts', {
      method: 'POST',
      body: data,
      apiVersion: 'v2',
    });
  }

  /**
   * Replace a contact (`PUT`). The v2 contacts API has no partial update, so
   * `data` must be the full record.
   */
  async update(id: number, data: ContactUpdateData): Promise<Contact> {
    return this.httpClient.request<Contact>(`/Contacts/${id}`, {
      method: 'PUT',
      body: data,
      apiVersion: 'v2',
    });
  }

  /**
   * Delete a contact
   */
  async delete(id: number): Promise<void> {
    await this.httpClient.request<void>(`/Contacts/${id}`, {
      method: 'DELETE',
      apiVersion: 'v2',
    });
  }
}
