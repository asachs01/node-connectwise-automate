/**
 * Patches integration tests
 *
 * These model the REAL Automate contract as published in ConnectWise's own
 * OpenAPI spec (Patching.json, Computers.json). Automate has no patch
 * catalog: the surface is the global PatchHistory log, per-computer
 * Microsoft / third-party patch status and statistics, and the PatchActions
 * family of fire-and-forget POSTs that take { EntityType, EntityId } and
 * answer 204.
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { ConnectWiseAutomateClient } from '../../src/client.js';
import { server } from '../mocks/server.js';
import type { PatchAction } from '../../src/types/patches.js';

const API_BASE = 'https://testserver.hostedrmm.com/cwa/api/v1';

const createClient = () =>
  new ConnectWiseAutomateClient({
    serverUrl: 'https://testserver.hostedrmm.com',
    clientId: 'test-client-id',
    credentials: {
      method: 'integrator',
      integratorUsername: 'test-user',
      integratorPassword: 'test-password',
    },
  });

/** Serve a GET route and capture the URL of each request that hits it. */
function serve(path: string, body: unknown) {
  const requests: URL[] = [];
  server.use(
    http.get(`${API_BASE}${path}`, ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json(body);
    })
  );
  return requests;
}

/** A PatchHistory row (Automate.Api.Domain.Contracts.Patching.PatchHistory). */
const historyRow = (computerId: number, kb: number) => ({
  ActionDate: '2024-01-15T03:00:00Z',
  ComputerId: computerId,
  OperationCode: { Id: 2, Name: 'Installation' },
  PatchHistoryClient: { Id: 100, Name: 'Acme Corporation' },
  PatchHistoryTitle: {
    Id: 9001,
    Title: `2024-01 Cumulative Update (KB${kb})`,
    KnowledgeBaseId: kb,
  },
  ResultCode: { Id: 2, Name: 'Succeeded' },
  UpdateId: '7f3a1c2e-0000-4000-8000-000000000001',
});

describe('Patches Resource', () => {
  describe('history', () => {
    it('returns the bare array Automate sends for GET /PatchHistory', async () => {
      const requests = serve('/PatchHistory', [historyRow(1, 5034122), historyRow(2, 5034123)]);

      const rows = await createClient().patches.history({
        condition: 'ComputerId = 1',
        pageSize: 10,
      });

      expect(rows).toHaveLength(2);
      expect(rows[0]?.PatchHistoryTitle?.KnowledgeBaseId).toBe(5034122);
      expect(rows[0]?.ResultCode).toEqual({ Id: 2, Name: 'Succeeded' });
      expect(Object.fromEntries(requests[0]?.searchParams ?? [])).toEqual({
        condition: 'ComputerId = 1',
        pageSize: '10',
      });
    });
  });

  describe('historyAll', () => {
    it('walks bare-array pages until a short page', async () => {
      const requests = serve('/PatchHistory', [historyRow(1, 1), historyRow(1, 2)]);

      const rows = await createClient().patches.historyAll().toArray();

      expect(rows.map((r) => r.PatchHistoryTitle?.KnowledgeBaseId)).toEqual([1, 2]);
      expect(requests).toHaveLength(1);
    });
  });

  describe('microsoftUpdates', () => {
    it('reads GET /Computers/{computerId}/MicrosoftUpdates', async () => {
      serve('/Computers/1/MicrosoftUpdates', [
        {
          Category: 'Security Updates',
          ComputerId: 1,
          InstallDate: '2024-01-15T03:05:00Z',
          InstallState: 'Installed',
          IsCompliant: true,
          IsFailed: false,
          IsInstalled: true,
          IsNonCompliant: false,
          KnowledgeBaseId: 5034122,
          MicrosoftUpdateId: '7f3a1c2e-0000-4000-8000-000000000001',
          PolicyApproval: { Id: 1, Name: 'Approved' },
          ReleaseDate: '2024-01-09T00:00:00Z',
          Severity: 'Critical',
          Title: '2024-01 Cumulative Update (KB5034122)',
          Cvss: 8.8,
        },
      ]);

      const updates = await createClient().patches.microsoftUpdates(1);

      expect(updates).toHaveLength(1);
      expect(updates[0]?.KnowledgeBaseId).toBe(5034122);
      expect(updates[0]?.PolicyApproval?.Name).toBe('Approved');
      expect(updates[0]?.Cvss).toBe(8.8);
    });
  });

  describe('thirdPartyPatches', () => {
    it('reads GET /Computers/{computerId}/ThirdPartyPatches', async () => {
      serve('/Computers/1/ThirdPartyPatches', [
        {
          ApprovedVersion: '121.0.1',
          AvailableVersion: '121.0.1',
          ComplianceState: { Id: 2, Name: 'Non-Compliant' },
          ComputerId: 1,
          DisplayTitle: 'Mozilla Firefox 121.0.1',
          InstallAction: { Id: 1, Name: 'Install' },
          InstallState: 'Missing',
          InstalledVersion: '120.0.0',
          Is64Bit: true,
          IsCompliant: false,
          IsFailed: false,
          IsInstalled: false,
          IsNonCompliant: true,
          Manufacturer: 'Mozilla',
          PatchId: 'a1b2c3d4-0000-4000-8000-000000000002',
          PolicyApproval: { Id: 1, Name: 'Approved' },
          SoftwareId: 'firefox',
          Title: 'Mozilla Firefox',
        },
      ]);

      const patches = await createClient().patches.thirdPartyPatches(1);

      expect(patches).toHaveLength(1);
      expect(patches[0]?.InstalledVersion).toBe('120.0.0');
      expect(patches[0]?.ComplianceState?.Name).toBe('Non-Compliant');
    });
  });

  describe('patchingStats', () => {
    it('reads GET /Computers/{computerId}/PatchingStats', async () => {
      serve('/Computers/1/PatchingStats', {
        ComputerId: 1,
        OverallCompliance: 92.5,
        InstalledPatchCount: 37,
        MissingPatchCount: 3,
        FailedPatchCount: 0,
        Stage: 'Production',
        PatchJobRunning: false,
        LastPatchedDate: '2024-01-15T03:05:00Z',
        NextInstallWindow: '2024-02-12T02:00:00Z',
        IsMicrosoftManaged: true,
        IsThirdPartyManaged: true,
      });

      const stats = await createClient().patches.patchingStats(1);

      expect(stats.ComputerId).toBe(1);
      expect(stats.OverallCompliance).toBe(92.5);
      expect(stats.MissingPatchCount).toBe(3);
      expect(stats.Stage).toBe('Production');
    });
  });

  describe('patch actions', () => {
    const actions: Array<[PatchAction, (client: ConnectWiseAutomateClient) => Promise<void>]> = [
      ['DeployAllApproved', (c) => c.patches.deployAllApproved({ EntityType: 1, EntityId: 42 })],
      ['DeployAllSecurity', (c) => c.patches.deployAllSecurity({ EntityType: 1, EntityId: 42 })],
      ['ReattemptFailed', (c) => c.patches.reattemptFailed({ EntityType: 1, EntityId: 42 })],
      ['SetToTestStage', (c) => c.patches.setToTestStage({ EntityType: 1, EntityId: 42 })],
      ['SetToPilotStage', (c) => c.patches.setToPilotStage({ EntityType: 1, EntityId: 42 })],
      ['SetToProductionStage', (c) => c.patches.setToProductionStage({ EntityType: 1, EntityId: 42 })],
    ];

    it.each(actions)('POSTs { EntityType, EntityId } to /PatchActions/%s and accepts 204', async (action, run) => {
      let received: unknown;
      server.use(
        http.post(`${API_BASE}/PatchActions/${action}`, async ({ request }) => {
          received = await request.json();
          return new HttpResponse(null, { status: 204 });
        })
      );

      await expect(run(createClient())).resolves.toBeUndefined();
      expect(received).toEqual({ EntityType: 1, EntityId: 42 });
    });
  });
});
