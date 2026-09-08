/**
 * Contact types for ConnectWise Automate.
 *
 * Contacts are served by the **v2** API. The v1 API exposes only a read-only
 * `GET /api/v1/Contacts` list (a different, `LabTech.Models.Contact` shape);
 * get/create/update/delete exist solely under `/api/v2/Contacts`. This module
 * models the v2 contract `Automate.Api.Domain.Contracts.Clients.Contact`,
 * whose primary key is `ContactId` (there is no `Id`).
 */

import type { BaseListParams } from './common.js';

/** Client reference as embedded on a v2 contact. */
export interface ContactClientRef {
  ClientId: number;
  Name?: string;
}

/** Location reference as embedded on a v2 contact. */
export interface ContactLocationRef {
  LocationId: number;
  Name?: string;
  Client?: ContactClientRef;
}

/** Contact source (`Automate.Api.Domain.Contracts.Clients.ContactSource`). */
export interface ContactSource {
  ContactSourceTypeId?: number;
  Name?: string;
}

/**
 * Contact entity (`Automate.Api.Domain.Contracts.Clients.Contact`).
 */
export interface Contact {
  ContactId: number;
  FirstName?: string;
  LastName?: string;
  EmailAddress?: string;
  PhoneNumber?: string;
  MobileNumber?: string;
  PagerNumber?: string;
  FaxNumber?: string;
  Address1?: string;
  Address2?: string;
  City?: string;
  State?: string;
  ZipCode?: string;
  Client?: ContactClientRef;
  Location?: ContactLocationRef;
  /** Write-only portal password; never returned. */
  Password?: string;
  Permissions?: string[];
  IsManaged?: boolean;
  IsActivated?: boolean;
  DateCreated?: string;
  LastUpdateDate?: string;
  PluginData?: Record<string, Record<string, unknown>>;
  Source?: ContactSource;
}

/**
 * Contact list parameters. `GET /api/v2/Contacts` takes only the shared
 * Automate list options; filter with `condition`.
 */
export type ContactListParams = BaseListParams;

/** `GET /api/v2/Contacts` returns a bare array. */
export type ContactListResponse = Contact[];

/**
 * Body for `POST /api/v2/Contacts`. The owning client is the nested
 * `Client: { ClientId }` reference.
 */
export interface ContactCreateData extends Omit<Contact, 'ContactId' | 'Client' | 'Location' | 'DateCreated' | 'LastUpdateDate'> {
  Client: { ClientId: number };
  Location?: { LocationId: number };
}

/**
 * Body for `PUT /api/v2/Contacts/{id}`. The v2 contacts API has no PATCH:
 * an update replaces the contact, so send the full record.
 */
export type ContactUpdateData = ContactCreateData;
