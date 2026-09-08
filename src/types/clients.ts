/**
 * Client (company) and Location types for ConnectWise Automate.
 *
 * Shapes follow the Automate v1 OpenAPI spec (Company.json / Computers.json):
 *   - `LabTech.Models.Client`   — GET/POST/PUT/PATCH /Clients[/{id}]
 *   - `LabTech.Models.Location` — GET /Locations/{id}, POST/PUT/PATCH
 *   - `Automate.Api.Domain.Contracts.Clients.Location` — rows of GET /Locations
 *
 * The spec types every `LabTech.Models.*.Id` as `string`; the API actually
 * serialises integers (nested ids such as `Location.Id` and `GroupPartial.ID`
 * are declared int32 in the same spec), so ids are numbers here.
 */

import type { BaseEntity, BaseListParams } from './common.js';

/**
 * Minimal embedded client reference, as nested on Location / Computer rows.
 */
export interface ClientRef {
  Id: number;
  Name?: string;
}

/**
 * Client entity (`LabTech.Models.Client`).
 */
export interface Client extends BaseEntity {
  Name: string;
  Company?: string;
  FirstName?: string;
  LastName?: string;
  Address1?: string;
  Address2?: string;
  City?: string;
  State?: string;
  ZipCode?: string;
  Country?: string;
  PhoneNumber?: string;
  FaxNumber?: string;
  Comment?: string;
  ExternalId?: string;
  UsesInHouseSupportStaff?: boolean;
  NewTicketNotificationEmail?: string;
  IsHiddenFromAllInclusiveGroup?: boolean;
  /** Populated when the server expands locations. */
  Locations?: Location[];
}

/**
 * Client list parameters. `GET /Clients` takes only the shared Automate list
 * options; filter with `condition`, e.g. `Name like '%acme%'`.
 */
export type ClientListParams = BaseListParams;

/** `GET /Clients` returns a bare array (no `{ Data, TotalRecords }` envelope). */
export type ClientListResponse = Client[];

/**
 * Body for `POST /Clients` (`LabTech.Models.Client`).
 */
export type ClientCreateData = Omit<Client, 'Id' | 'Locations'>;

/**
 * Fields accepted by `update()`; each defined key becomes a JSON Patch
 * `replace` operation on `PATCH /Clients/{id}`.
 */
export type ClientUpdateData = Partial<ClientCreateData>;

/**
 * Location entity.
 *
 * Union of `LabTech.Models.Location` (single-item routes) and
 * `Automate.Api.Domain.Contracts.Clients.Location` (list rows). Fields only
 * present on list rows are marked. There is no flat `ClientId`; the parent
 * client is the nested `Client` reference.
 */
export interface Location extends BaseEntity {
  /** List rows only: duplicate of `Id`. */
  LocationId?: number;
  Name?: string;
  Client?: ClientRef;
  Address1?: string;
  Address2?: string;
  City?: string;
  State?: string;
  ZipCode?: string;
  Country?: string;
  PhoneNumber?: string;
  FaxNumber?: string;
  Comments?: string;
  /** Embedded `LabTech.Models.Contact` (v1 shape) when present. */
  Contact?: { Id?: number; FirstName?: string; LastName?: string; Email?: string };
  RouterPort?: number;
  ScriptDrive?: string;
  ScriptUsername?: string;
  ScriptPassword?: string;
  ScriptRouterAddress?: string;
  ScriptExtra1?: string;
  ScriptExtra2?: string;
  ProbeId?: number;
  ExternalId?: number;
  /** List rows only. */
  ExtraFields?: LocationExtraField[];
}

/**
 * Extra field as embedded on `GET /Locations` rows
 * (`Automate.Api.Domain.Contracts.ExtraFields.ExtraField`, trimmed to the
 * identifying fields).
 */
export interface LocationExtraField {
  TargetId?: number;
  ExtraFieldDefinitionId?: number;
  Title?: string;
  Section?: string;
  IsReadOnly?: boolean;
  IsEncrypted?: boolean;
}

/**
 * Location list parameters. `clientId` is a convenience that the SDK turns
 * into `condition: Client.Id = <id>` — Automate has no `clientId` query
 * parameter on `GET /Locations`, and unknown parameters are silently ignored.
 */
export interface LocationListParams extends BaseListParams {
  /** Restrict to locations belonging to this client. */
  clientId?: number;
}

/** `GET /Locations` returns a bare array. */
export type LocationListResponse = Location[];

/**
 * Body for `POST /Locations` (`LabTech.Models.Location`). The owning client is
 * the nested `Client: { Id }` reference.
 */
export interface LocationCreateData extends Omit<Location, 'Id' | 'LocationId' | 'Client' | 'ExtraFields'> {
  Name: string;
  Client: { Id: number };
}

/**
 * Fields accepted by `update()`; each defined key becomes a JSON Patch
 * `replace` operation on `PATCH /Locations/{id}`.
 */
export type LocationUpdateData = Partial<Omit<LocationCreateData, 'Client'>>;
