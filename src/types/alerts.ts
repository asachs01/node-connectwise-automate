/**
 * Alert types for ConnectWise Automate
 *
 * Mirrors `Automate.Api.Domain.Contracts.Alerts.Alert` from ConnectWise's
 * published OpenAPI spec (Computers.json). An alert is keyed by `AlertId`
 * (not `Id`) and refers to its client, computer, location, monitor and
 * severity through nested `{ Id, Name }` objects rather than flat columns.
 */

import type { BaseListParams } from './common.js';

/** Id/Name pair used for the entities an alert refers to */
export interface AlertReference {
  Id: number;
  Name: string;
}

/** The computer an alert was raised against */
export interface AlertComputer extends AlertReference {
  /** Agent status at the time of the read, e.g. `Online` */
  ComputerStatus?: string;
}

/**
 * Alert entity
 */
export interface Alert {
  AlertId: number;
  Client?: AlertReference;
  Computer?: AlertComputer;
  Device?: AlertReference;
  Location?: AlertReference;
  /** The monitor that raised the alert */
  Monitor?: AlertReference;
  /** When the alert was raised (ISO 8601) */
  AlertDate?: string;
  /** Severity lookup, e.g. `{ Id: 3, Name: 'Warning' }` */
  Severity?: AlertReference;
  /** Where the alert came from, e.g. the monitor category */
  Source?: string;
  /** Alert message text */
  Message?: string;
  /** The monitored field that tripped */
  FieldName?: string;
  /** Age of the alert as a duration string */
  AlertAge?: string;
}

/**
 * Alert list parameters.
 *
 * Automate exposes no dedicated alert filters; narrow results with
 * `condition`, e.g. `Severity.Name = 'Critical'` or `Computer.Id = 42`.
 */
export type AlertListParams = BaseListParams;
