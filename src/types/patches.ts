/**
 * Patch management types for ConnectWise Automate
 *
 * Mirrors the patching contracts in ConnectWise's published OpenAPI spec
 * (Patching.json, Computers.json). Automate has no patch catalog entity;
 * patch state is observed per computer and through the PatchHistory log,
 * and patching is driven through the PatchActions routes.
 */

import type { BaseListParams } from './common.js';

/** Id/Name lookup value used throughout the patching contracts */
export interface PatchLookup {
  Id: number;
  Name: string;
}

/**
 * A PatchHistory row (`Automate.Api.Domain.Contracts.Patching.PatchHistory`)
 */
export interface PatchHistory {
  /** When the operation happened (ISO 8601) */
  ActionDate?: string;
  ComputerId: number;
  /** Windows Update operation, e.g. `Installation` */
  OperationCode?: PatchLookup;
  PatchHistoryClient?: PatchLookup;
  PatchHistoryTitle?: {
    Id: number;
    Title: string;
    KnowledgeBaseId: number;
  };
  /** Windows Update result, e.g. `Succeeded` */
  ResultCode?: PatchLookup;
  /** Microsoft update GUID */
  UpdateId?: string;
}

/**
 * Patch history list parameters. Narrow with `condition`, e.g. `ComputerId = 42`.
 */
export type PatchHistoryListParams = BaseListParams;

/**
 * A Microsoft update as seen on one computer
 * (`LabTech.Models.ComputerMicrosoftUpdateData`)
 */
export interface ComputerMicrosoftUpdate {
  Category?: string;
  ComputerId: number;
  InstallDate?: string;
  /** e.g. `Installed`, `Missing`, `Failed` */
  InstallState?: string;
  IsCompliant?: boolean;
  IsFailed?: boolean;
  IsInstalled?: boolean;
  IsNonCompliant?: boolean;
  KnowledgeBaseId?: number;
  /** Microsoft update GUID */
  MicrosoftUpdateId?: string;
  /** Approval state under the effective policy */
  PolicyApproval?: PatchLookup;
  ReleaseDate?: string;
  /** Microsoft severity text, e.g. `Critical` */
  Severity?: string;
  Title?: string;
  Cvss?: number;
}

/**
 * A third-party patch as seen on one computer
 * (`LabTech.Models.ComputerThirdPartyPatch`)
 */
export interface ComputerThirdPartyPatch {
  ApprovedVersion?: string;
  AvailableVersion?: string;
  ComplianceState?: PatchLookup;
  ComputerId: number;
  DisplayTitle?: string;
  InstallAction?: PatchLookup;
  InstallDate?: string;
  InstallState?: string;
  InstalledVersion?: string;
  Is64Bit?: boolean;
  IsCompliant?: boolean;
  IsFailed?: boolean;
  IsInstalled?: boolean;
  IsNonCompliant?: boolean;
  Manufacturer?: string;
  /** Third-party patch GUID */
  PatchId?: string;
  PolicyApproval?: PatchLookup;
  SoftwareId?: string;
  Title?: string;
}

/**
 * Patching statistics for one computer
 * (`Automate.Api.Domain.Contracts.Patching.ComputerPatchingStats`)
 */
export interface ComputerPatchingStats {
  ComputerId: number;
  /** Overall compliance percentage */
  OverallCompliance?: number;
  InstalledPatchCount?: number;
  MissingPatchCount?: number;
  FailedPatchCount?: number;
  CompliantSoftwareCount?: number;
  NonCompliantSoftwareCount?: number;
  FailedSoftwareCount?: number;
  IncorrectSoftwareCount?: number;
  /** Approval stage, e.g. `Test`, `Pilot`, `Production` */
  Stage?: string;
  NoPatchInventory?: boolean;
  WSUSEnabled?: boolean;
  PatchJobRunning?: boolean;
  DaytimePatchingEnabled?: boolean;
  WUAOutOfDate?: boolean;
  MissingBaselinePatches?: boolean;
  WUAVersion?: string;
  LastInstallWindow?: string;
  NextInstallWindow?: string;
  LastSoftwareWindow?: string;
  NextSoftwareWindow?: string;
  LastPatchedDate?: string;
  LastMicrosoftPatchedDate?: string;
  LastThirdPartyPatchedDate?: string;
  LastPatchInventory?: string;
  IsMicrosoftManaged?: boolean;
  IsThirdPartyManaged?: boolean;
}

/** The PatchActions routes Automate exposes (`POST /PatchActions/{action}`) */
export type PatchAction =
  | 'DeployAllApproved'
  | 'DeployAllSecurity'
  | 'ReattemptFailed'
  | 'SetToTestStage'
  | 'SetToPilotStage'
  | 'SetToProductionStage';

/**
 * Target of a patch action (`LabTech.Models.PatchActionArgs`)
 */
export interface PatchActionArgs {
  /**
   * Automate entity-type ordinal. The spec types this as an integer with no
   * enum; the Batch contracts list the same entity types as strings in the
   * order System, Computer, Site, Company, ..., Group, so Computer is 1.
   */
  EntityType: number;
  /** Id of the computer, location, client or group to act on */
  EntityId: number;
}
