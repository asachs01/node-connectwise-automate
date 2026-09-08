/**
 * Group types for ConnectWise Automate.
 *
 * Shapes follow the Automate v1 OpenAPI spec (Groups.json):
 *   - `LabTech.Models.Group`         — GET /Groups[/{id}]
 *   - `LabTech.Models.GroupComputer` — GET/POST/DELETE /GroupComputers[/{id}]
 *
 * Group membership is not a sub-route of `/Groups`; computer membership is the
 * separate `/GroupComputers` collection filtered by `condition`.
 */

import type { BaseEntity, BaseListParams } from './common.js';

/** Ancestor reference (`LabTech.Models.GroupPartial`). */
export interface GroupPartial {
  ID: number;
  ParentId?: number;
  Name?: string;
}

/** Auto-join search reference (`LabTech.Models.Search`). */
export interface GroupSearchRef {
  Id: number;
  Name?: string;
  IsReadOnly?: boolean;
  SearchType?: 'AdvancedComputers' | 'AdvancedNetDevices' | 'AdvancedContacts' | 'AdvancedMobileDevices';
}

/**
 * Group entity (`LabTech.Models.Group`).
 */
export interface Group extends BaseEntity {
  Name: string;
  /** Full path, e.g. `Service Plans.Windows Servers.Managed 24x7`. */
  FullName?: string;
  ParentId?: number;
  SubGroups?: number[];
  ParentGroups?: number[];
  Parents?: GroupPartial[];
  Depth?: number;
  TypeId?: number;
  TypeName?: string;
  TemplatePriority?: number;
  GUID?: string;
  ComputersAutoJoinSearch?: GroupSearchRef;
  NetworkDevicesAutoJoinSearch?: GroupSearchRef;
  ContactsAutoJoinSearch?: GroupSearchRef;
  ComputersLimitToSearch?: boolean;
  NetworkDevicesLimitToSearch?: boolean;
  ContactsLimitToSearch?: boolean;
  ContactsJoinComputers?: boolean;
  MaintenanceWindowLastApplied?: string;
  Comments?: string;
}

/**
 * Group list parameters. `GET /Groups` takes only the shared Automate list
 * options; filter with `condition`, e.g. `ParentId = 3` or
 * `FullName like 'Service Plans%'`.
 */
export type GroupListParams = BaseListParams;

/** `GET /Groups` returns a bare array. */
export type GroupListResponse = Group[];

/**
 * Computer membership row (`LabTech.Models.GroupComputer`).
 *
 * `Id` is the membership row's own key (string in the spec) and is what
 * `DELETE /GroupComputers/{id}` takes.
 */
export interface GroupComputer {
  Id: string;
  GroupId: number;
  ComputerId: number;
}

/** Membership list parameters (`GET /GroupComputers`). */
export type GroupComputerListParams = BaseListParams;

/** `GET /GroupComputers` returns a bare array. */
export type GroupComputerListResponse = GroupComputer[];
