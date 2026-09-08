/**
 * Computers integration tests
 *
 * Wire shapes follow ConnectWise's Automate swagger (Computers.json,
 * Commands.json): list routes return bare arrays, `GET /Computers` filters
 * only through `condition`, and a command's outcome is read back from its own
 * CommandExecute row via the `ids` filter.
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { ConnectWiseAutomateClient } from '../../src/client.js';
import { ConnectWiseAutomateNotFoundError } from '../../src/errors.js';
import { server } from '../mocks/server.js';
import * as fixtures from '../fixtures/index.js';
import type { ComputerCommandExecution } from '../../src/types/computers.js';

const API = 'https://testserver.hostedrmm.com/cwa/api/v1';

describe('Computers Resource', () => {
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

  /** Serve the first page for GET /Computers and capture its query string. */
  function captureListQuery(): () => URLSearchParams | undefined {
    let query: URLSearchParams | undefined;
    server.use(
      http.get(`${API}/Computers`, ({ request }) => {
        query = new URL(request.url).searchParams;
        return HttpResponse.json(fixtures.computers.listPage1);
      })
    );
    return () => query;
  }

  describe('list', () => {
    it('should return the bare array Automate sends', async () => {
      const client = createClient();
      const computers = await client.computers.list();

      expect(Array.isArray(computers)).toBe(true);
      expect(computers).toHaveLength(2);
      expect(computers[0]?.ComputerName).toBe('WORKSTATION-001');
    });

    it('should support pagination', async () => {
      const client = createClient();
      const page1 = await client.computers.list({ page: 1 });
      const page2 = await client.computers.list({ page: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(1);
      expect(page2[0]?.ComputerName).toBe('LAPTOP-001');
    });

    it('should express clientId, locationId and isOnline as a condition', async () => {
      // GET /Computers has no such query parameters — filtering is only
      // possible through `condition` — so the convenience filters must be
      // folded into one expression.
      const client = createClient();
      const getQuery = captureListQuery();

      await client.computers.list({ clientId: 100, locationId: 1, isOnline: true });

      const query = getQuery();
      expect(query?.get('condition')).toBe(
        "(Client.Id = 100) and (Location.Id = 1) and (Status = 'Online')"
      );
      expect(query?.has('clientId')).toBe(false);
      expect(query?.has('locationId')).toBe(false);
      expect(query?.has('isOnline')).toBe(false);
    });

    it('should combine a caller condition with the convenience filters', async () => {
      const client = createClient();
      const getQuery = captureListQuery();

      await client.computers.list({
        condition: "ComputerName like '%web%'",
        isOnline: false,
      });

      expect(getQuery()?.get('condition')).toBe(
        "(ComputerName like '%web%') and (Status = 'Offline')"
      );
    });

    it('should pass a bare condition through untouched', async () => {
      const client = createClient();
      const getQuery = captureListQuery();

      await client.computers.list({ condition: 'Client.Id = 7' });

      expect(getQuery()?.get('condition')).toBe('Client.Id = 7');
    });
  });

  describe('listAll', () => {
    it('should iterate all computers from first page', async () => {
      const client = createClient();
      const computers = await client.computers.listAll().toArray();

      // The mock returns 2 items on page 1, which is less than pageSize (100),
      // so pagination stops after first page
      expect(computers).toHaveLength(2);
      expect(computers[0]?.ComputerName).toBe('WORKSTATION-001');
      expect(computers[1]?.ComputerName).toBe('SERVER-001');
    });
  });

  describe('get', () => {
    it('should get a single computer with its real field names', async () => {
      const client = createClient();
      const computer = await client.computers.get(1);

      expect(computer.Id).toBe(1);
      expect(computer.ComputerName).toBe('WORKSTATION-001');
      expect(computer.OperatingSystemName).toBe('Windows 11 Pro');
      expect(computer.Status).toBe('Online');
      expect(computer.Client?.Id).toBe(100);
      expect(computer.Location?.Name).toBe('Main Office');
      expect(computer.RemoteAgentLastContact).toBe('2024-01-15T10:30:00Z');
      expect(computer.SerialNumber).toBe('ABC123456');
    });

    it('should throw NotFoundError for non-existent computer', async () => {
      const client = createClient();

      await expect(client.computers.get(999)).rejects.toThrow(ConnectWiseAutomateNotFoundError);
    });
  });

  describe('executeCommand', () => {
    it('should post the command as a nested catalog reference', async () => {
      const client = createClient();
      let sentBody: unknown;

      server.use(
        http.post(`${API}/Computers/:id/CommandExecute`, async ({ request }) => {
          sentBody = await request.json();
          return HttpResponse.json(fixtures.computers.commandResult);
        })
      );

      const result = await client.computers.executeCommand(1, {
        Command: { Id: '2' },
        Parameters: ['ipconfig /all'],
      });

      // The command must travel as an object carrying its catalog id, and the
      // computer id must be echoed into the body — a flat command string binds
      // to nothing server-side and the run terminates on arrival.
      expect(sentBody).toEqual({
        Command: { Id: '2' },
        Parameters: ['ipconfig /all'],
        ComputerId: 1,
      });
      expect(result.Command?.Id).toBe('2');
      expect(result.Status).toBe('Success');
    });
  });

  describe('commandExecutions', () => {
    it('should pass ids through so a single execution can be fetched', async () => {
      const client = createClient();
      let query: URLSearchParams | undefined;

      server.use(
        http.get(`${API}/Computers/:id/CommandExecute`, ({ request }) => {
          query = new URL(request.url).searchParams;
          return HttpResponse.json([fixtures.computers.commandResult]);
        })
      );

      const rows = await client.computers.commandExecutions(1, { ids: '4711' });

      expect(query?.get('ids')).toBe('4711');
      expect(rows).toHaveLength(1);
      expect(rows[0]?.Id).toBe(4711);
    });
  });

  describe('executeCommandAndWait', () => {
    const row = (
      overrides: Partial<ComputerCommandExecution> = {}
    ): ComputerCommandExecution => ({
      Id: 4711,
      ComputerId: 1,
      Command: { Id: '2', Name: 'Command Prompt' },
      Parameters: ['ipconfig /all'],
      Status: 'Pending',
      ...overrides,
    });

    /**
     * Mock the execute POST and a sequence of GET CommandExecute responses;
     * the last response repeats once the sequence is exhausted. Returns the
     * `ids` value each poll carried and a count of CommandHistory reads.
     */
    function mockExecution(
      posted: ComputerCommandExecution,
      polls: ComputerCommandExecution[][]
    ): { polledIds: (string | null)[]; historyReads: () => number } {
      const polledIds: (string | null)[] = [];
      let historyReads = 0;

      server.use(
        http.post(`${API}/Computers/:id/CommandExecute`, () => HttpResponse.json(posted)),
        http.get(`${API}/Computers/:id/CommandExecute`, ({ request }) => {
          polledIds.push(new URL(request.url).searchParams.get('ids'));
          const next = polls.length > 1 ? polls.shift() : polls[0];
          return HttpResponse.json(next ?? []);
        }),
        http.get(`${API}/Computers/:id/CommandHistory`, () => {
          historyReads++;
          return HttpResponse.json(fixtures.computers.commandHistory);
        })
      );

      return { polledIds, historyReads: () => historyReads };
    }

    it('should poll the execute row by its id until the status is terminal', async () => {
      const client = createClient();
      const { polledIds, historyReads } = mockExecution(row(), [
        [row({ Status: 'Executing' })],
        [row({ Status: 'Success', Output: 'Windows IP Configuration' })],
      ]);

      const result = await client.computers.executeCommandAndWait(
        1,
        { Command: { Id: '2' }, Parameters: ['ipconfig /all'] },
        { pollIntervalMs: 1, timeoutMs: 5_000 }
      );

      expect(result.completed).toBe(true);
      expect(result.status).toBe('Success');
      expect(result.output).toBe('Windows IP Configuration');
      expect(result.execution.Id).toBe(4711);
      // Correlation is by the id the execute call returned, on the execute
      // route itself — never by scanning CommandHistory for "something new".
      expect(polledIds).toHaveLength(2);
      expect(polledIds.every((id) => id === '4711')).toBe(true);
      expect(historyReads()).toBe(0);
    });

    it('should report a failed command as completed, with its status', async () => {
      const client = createClient();
      mockExecution(row(), [[row({ Status: 'Failed', Output: 'Access is denied.' })]]);

      const result = await client.computers.executeCommandAndWait(
        1,
        { Command: { Id: '2' } },
        { pollIntervalMs: 1, timeoutMs: 5_000 }
      );

      expect(result.completed).toBe(true);
      expect(result.status).toBe('Failed');
      expect(result.output).toBe('Access is denied.');
    });

    it('should only read the row carrying the returned id', async () => {
      const client = createClient();
      const stale = row({ Id: 4000, Status: 'Success', Output: 'stale' });
      mockExecution(row(), [
        [stale, row({ Status: 'Executing' })],
        [stale, row({ Status: 'Success', Output: 'fresh' })],
      ]);

      const result = await client.computers.executeCommandAndWait(
        1,
        { Command: { Id: '2' } },
        { pollIntervalMs: 1, timeoutMs: 5_000 }
      );

      expect(result.execution.Id).toBe(4711);
      expect(result.output).toBe('fresh');
    });

    it('should not poll when the execute call already reports a terminal status', async () => {
      const client = createClient();
      const { polledIds } = mockExecution(row({ Status: 'Terminated' }), []);

      const result = await client.computers.executeCommandAndWait(
        1,
        { Command: { Id: '2' } },
        { pollIntervalMs: 1, timeoutMs: 5_000 }
      );

      expect(result.completed).toBe(true);
      expect(result.status).toBe('Terminated');
      expect(polledIds).toHaveLength(0);
    });

    it('should give up after the timeout and report the last observed status', async () => {
      const client = createClient();
      mockExecution(row(), [[row({ Status: 'Executing' })]]);

      const result = await client.computers.executeCommandAndWait(
        1,
        { Command: { Id: '2' } },
        { pollIntervalMs: 1, timeoutMs: 40 }
      );

      expect(result.completed).toBe(false);
      expect(result.status).toBe('Executing');
      expect(result.execution.Id).toBe(4711);
      expect(result.waitedMs).toBeGreaterThanOrEqual(40);
    });
  });

  describe('commandHistory', () => {
    it('should return the bare array Automate sends', async () => {
      const client = createClient();

      server.use(
        http.get(`${API}/Computers/:id/CommandHistory`, () =>
          HttpResponse.json(fixtures.computers.commandHistory)
        )
      );

      const history = await client.computers.commandHistory(1);

      expect(Array.isArray(history)).toBe(true);
      expect(history[0]?.Status).toBe('Success');
      expect(history[0]?.DateFinished).toBe('2024-01-15T10:35:04Z');
    });
  });

  describe('commands', () => {
    it('should list the command catalog', async () => {
      const client = createClient();

      server.use(
        http.get(`${API}/Commands`, () => HttpResponse.json(fixtures.computers.commandCatalog))
      );

      const commands = await client.computers.commands();

      expect(commands).toHaveLength(2);
      expect(commands[1]?.Name).toBe('Command Prompt');
    });

    it('should get a single catalog command', async () => {
      const client = createClient();

      server.use(
        http.get(`${API}/Commands/:id`, ({ params }) =>
          HttpResponse.json(
            fixtures.computers.commandCatalog.find((c) => c.Id === params['id'])
          )
        )
      );

      const command = await client.computers.getCommand('2');

      expect(command.Name).toBe('Command Prompt');
    });
  });
});
