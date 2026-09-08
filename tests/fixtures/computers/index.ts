/**
 * Computer fixtures
 *
 * Shapes follow ConnectWise's Automate swagger: list routes return bare
 * arrays, and computers carry `LabTech.Models.Computer` field names
 * (`OperatingSystemName`, `Status`, `RemoteAgentLastContact`, nested
 * `Client`/`Location`), not the flattened names an earlier draft invented.
 */

export const listPage1 = [
  {
    Id: 1,
    ComputerName: 'WORKSTATION-001',
    Client: { Id: 100, Name: 'Acme Corp' },
    Location: { Id: 1, Name: 'Main Office' },
    OperatingSystemName: 'Windows 11 Pro',
    Status: 'Online',
    RemoteAgentLastContact: '2024-01-15T10:30:00Z',
    LocalIPAddress: '192.168.1.101',
    RemoteAgentVersion: '2024.1.0.0',
  },
  {
    Id: 2,
    ComputerName: 'SERVER-001',
    Client: { Id: 100, Name: 'Acme Corp' },
    Location: { Id: 1, Name: 'Main Office' },
    OperatingSystemName: 'Windows Server 2022',
    Status: 'Online',
    RemoteAgentLastContact: '2024-01-15T10:29:00Z',
    LocalIPAddress: '192.168.1.10',
    RemoteAgentVersion: '2024.1.0.0',
  },
];

export const listPage2 = [
  {
    Id: 3,
    ComputerName: 'LAPTOP-001',
    Client: { Id: 101, Name: 'Globex' },
    Location: { Id: 2, Name: 'Branch' },
    OperatingSystemName: 'Windows 11 Home',
    Status: 'Offline',
    RemoteAgentLastContact: '2024-01-14T18:00:00Z',
    LocalIPAddress: '192.168.2.50',
    RemoteAgentVersion: '2024.1.0.0',
  },
];

export const single = {
  Id: 1,
  ComputerName: 'WORKSTATION-001',
  Client: { Id: 100, Name: 'Acme Corp' },
  Location: { Id: 1, Name: 'Main Office' },
  DomainName: 'CORPORATE',
  LastUserName: 'jsmith',
  OperatingSystemName: 'Windows 11 Pro',
  OperatingSystemVersion: '10.0.22621',
  Type: 'Workstation',
  Status: 'Online',
  BiosManufacturer: 'Dell Inc.',
  BiosFlash: '2.1.0',
  SerialNumber: 'ABC123456',
  TotalMemory: 17179869184,
  FreeMemory: 8589934592,
  LocalIPAddress: '192.168.1.101',
  GatewayIPAddress: '192.168.1.1',
  MACAddress: '00:11:22:33:44:55',
  RemoteAgentLastContact: '2024-01-15T10:30:00Z',
  LastHeartbeat: '2024-01-15T10:29:30Z',
  DateAdded: '2023-06-01T09:00:00Z',
  RemoteAgentVersion: '2024.1.0.0',
  IsNetworkProbe: false,
  IsVirtualMachine: false,
  IsRebootNeeded: false,
  SystemUptime: 86400,
  Comment: 'Primary workstation for John Smith',
  AssetTag: 'WS-001',
};

/**
 * Shape returned by `POST /Computers/{id}/CommandExecute`.
 * Mirrors Automate's `LabTech.Models.CommandExecute`: the command echoes back
 * as a nested catalog object, parameters are a positional string array, and
 * Status is free-form server text.
 */
export const commandResult = {
  Id: 4711,
  ComputerId: 1,
  Command: {
    Id: '2',
    Name: 'Command Prompt',
    Description: 'Run a command prompt command',
    Level: 1,
  },
  Status: 'Success',
  Parameters: ['ipconfig /all'],
  Output: 'Windows IP Configuration',
  Fastalk: false,
  DateLastInventoried: '2024-01-15T10:35:00Z',
};

/** Automate's command catalog, `GET /Commands` — a bare array. */
export const commandCatalog = [
  { Id: '1', Name: 'Resend System Info', Description: 'Re-inventory', Level: 1 },
  {
    Id: '2',
    Name: 'Command Prompt',
    Description: 'Run a command prompt command',
    Level: 1,
  },
];

/** `GET /Computers/{id}/CommandHistory` — a bare array. */
export const commandHistory = [
  {
    Id: 4711,
    ComputerId: 1,
    DateExecuted: '2024-01-15T10:35:00Z',
    CommandId: 2,
    Command: 'Command Prompt',
    Status: 'Success',
    Output: 'Windows IP Configuration',
    Parameters: 'ipconfig /all',
    User: 'integrator',
    DateFinished: '2024-01-15T10:35:04Z',
  },
];
