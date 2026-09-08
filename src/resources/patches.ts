/**
 * Patch management resource operations
 *
 * Automate has no patch catalog API. ConnectWise's published OpenAPI spec
 * (Patching.json, Computers.json) exposes the global PatchHistory log,
 * per-computer Microsoft / third-party patch status and statistics, and the
 * PatchActions family of fire-and-forget POSTs. Approval is policy-driven
 * and read-only over REST. List routes return a bare JSON array.
 */

import type { HttpClient } from '../http.js';
import type { PaginatedIterable } from '../pagination.js';
import { createPaginatedIterable } from '../pagination.js';
import { buildBaseListParams } from '../params.js';
import type { BaseListParams } from '../types/common.js';
import type {
  ComputerMicrosoftUpdate,
  ComputerPatchingStats,
  ComputerThirdPartyPatch,
  PatchAction,
  PatchActionArgs,
  PatchHistory,
  PatchHistoryListParams,
} from '../types/patches.js';

/**
 * Patch management resource operations
 */
export class PatchesResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * List patch history. Narrow with `condition`, e.g. `ComputerId = 42`.
   */
  async history(params?: PatchHistoryListParams): Promise<PatchHistory[]> {
    return this.httpClient.request<PatchHistory[]>('/PatchHistory', {
      params: buildBaseListParams(params),
    });
  }

  /**
   * List all patch history with automatic pagination
   */
  historyAll(
    params?: Omit<PatchHistoryListParams, 'pageSize' | 'page'>
  ): PaginatedIterable<PatchHistory> {
    return createPaginatedIterable<PatchHistory>(
      this.httpClient,
      '/PatchHistory',
      buildBaseListParams(params)
    );
  }

  /**
   * Microsoft updates and their install state on one computer
   */
  async microsoftUpdates(
    computerId: number,
    params?: BaseListParams
  ): Promise<ComputerMicrosoftUpdate[]> {
    return this.httpClient.request<ComputerMicrosoftUpdate[]>(
      `/Computers/${computerId}/MicrosoftUpdates`,
      { params: buildBaseListParams(params) }
    );
  }

  /**
   * Third-party patches and their install state on one computer
   */
  async thirdPartyPatches(
    computerId: number,
    params?: BaseListParams
  ): Promise<ComputerThirdPartyPatch[]> {
    return this.httpClient.request<ComputerThirdPartyPatch[]>(
      `/Computers/${computerId}/ThirdPartyPatches`,
      { params: buildBaseListParams(params) }
    );
  }

  /**
   * Patch compliance statistics for one computer
   */
  async patchingStats(computerId: number): Promise<ComputerPatchingStats> {
    return this.httpClient.request<ComputerPatchingStats>(
      `/Computers/${computerId}/PatchingStats`
    );
  }

  /** Deploy every approved patch to the target entity */
  async deployAllApproved(target: PatchActionArgs): Promise<void> {
    await this.patchAction('DeployAllApproved', target);
  }

  /** Deploy every approved security patch to the target entity */
  async deployAllSecurity(target: PatchActionArgs): Promise<void> {
    await this.patchAction('DeployAllSecurity', target);
  }

  /** Retry patches that previously failed on the target entity */
  async reattemptFailed(target: PatchActionArgs): Promise<void> {
    await this.patchAction('ReattemptFailed', target);
  }

  /** Move the target entity to the Test approval stage */
  async setToTestStage(target: PatchActionArgs): Promise<void> {
    await this.patchAction('SetToTestStage', target);
  }

  /** Move the target entity to the Pilot approval stage */
  async setToPilotStage(target: PatchActionArgs): Promise<void> {
    await this.patchAction('SetToPilotStage', target);
  }

  /** Move the target entity to the Production approval stage */
  async setToProductionStage(target: PatchActionArgs): Promise<void> {
    await this.patchAction('SetToProductionStage', target);
  }

  /**
   * POST /PatchActions/{action}. Automate answers 204 with no body; the
   * action is queued, and its outcome is only observable through history.
   */
  private async patchAction(action: PatchAction, target: PatchActionArgs): Promise<void> {
    await this.httpClient.request<void>(`/PatchActions/${action}`, {
      method: 'POST',
      body: target,
    });
  }
}
