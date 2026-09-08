/**
 * Alerts integration tests
 *
 * These model the REAL Automate contract as published in ConnectWise's own
 * OpenAPI spec (Computers.json): the alert surface is read-only —
 * GET /Alerts, GET /Alerts/{alertId} and GET /Computers/{computerId}/Alerts —
 * list routes return a bare JSON array, and an alert is keyed by `AlertId`
 * with nested `{ Id, Name }` references rather than flat *Id/*Name columns.
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { ConnectWiseAutomateClient } from '../../src/client.js';
import { server } from '../mocks/server.js';

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

/** An alert row as Automate returns it (Automate.Api.Domain.Contracts.Alerts.Alert). */
const alertRow = (alertId: number, overrides: Record<string, unknown> = {}) => ({
  AlertId: alertId,
  Client: { Id: 100, Name: 'Acme Corporation' },
  Computer: { Id: 1, Name: 'WORKSTATION-001', ComputerStatus: 'Online' },
  Device: { Id: 0, Name: '' },
  Location: { Id: 1, Name: 'Headquarters' },
  Monitor: { Id: 55, Name: 'CPU Usage' },
  AlertDate: '2024-01-15T10:00:00Z',
  Severity: { Id: 3, Name: 'Warning' },
  Source: 'Performance Monitor',
  Message: 'CPU usage exceeded 90% for 15 minutes',
  FieldName: 'CPU',
  AlertAge: '00:15:00',
  ...overrides,
});

/** Serve a route and capture the URL of each request that hits it. */
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

describe('Alerts Resource', () => {
  describe('list', () => {
    it('returns the bare array Automate sends for GET /Alerts', async () => {
      serve('/Alerts', [alertRow(1), alertRow(2), alertRow(3)]);

      const alerts = await createClient().alerts.list();

      expect(alerts).toHaveLength(3);
      expect(alerts[0]?.AlertId).toBe(1);
      expect(alerts[0]?.Computer?.Name).toBe('WORKSTATION-001');
      expect(alerts[0]?.Severity).toEqual({ Id: 3, Name: 'Warning' });
    });

    it('sends only the query parameters Automate defines', async () => {
      const requests = serve('/Alerts', []);

      await createClient().alerts.list({
        condition: "Severity.Name = 'Critical'",
        pageSize: 25,
        page: 2,
        orderBy: 'AlertDate desc',
      });

      const query = Object.fromEntries(requests[0]?.searchParams ?? []);
      expect(query).toEqual({
        condition: "Severity.Name = 'Critical'",
        pageSize: '25',
        page: '2',
        orderBy: 'AlertDate desc',
      });
    });
  });

  describe('listAll', () => {
    it('walks bare-array pages until a short page', async () => {
      const requests = serve('/Alerts', [alertRow(1), alertRow(2)]);

      const alerts = await createClient().alerts.listAll().toArray();

      expect(alerts.map((a) => a.AlertId)).toEqual([1, 2]);
      expect(requests).toHaveLength(1);
      expect(requests[0]?.searchParams.get('page')).toBe('1');
    });
  });

  describe('get', () => {
    it('gets a single alert from GET /Alerts/{alertId}', async () => {
      serve('/Alerts/7', alertRow(7, { Message: 'Disk C: has less than 10% free space' }));

      const alert = await createClient().alerts.get(7);

      expect(alert.AlertId).toBe(7);
      expect(alert.Message).toBe('Disk C: has less than 10% free space');
      expect(alert.Client).toEqual({ Id: 100, Name: 'Acme Corporation' });
      expect(alert.AlertDate).toBe('2024-01-15T10:00:00Z');
    });
  });

  describe('listForComputer', () => {
    it('reads GET /Computers/{computerId}/Alerts as a bare array', async () => {
      const requests = serve('/Computers/1/Alerts', [alertRow(1), alertRow(4)]);

      const alerts = await createClient().alerts.listForComputer(1, { pageSize: 50 });

      expect(alerts.map((a) => a.AlertId)).toEqual([1, 4]);
      expect(requests[0]?.searchParams.get('pageSize')).toBe('50');
    });
  });
});
