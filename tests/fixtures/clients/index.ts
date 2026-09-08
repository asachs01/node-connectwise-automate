/**
 * Client and location fixtures.
 *
 * Shapes mirror the Automate OpenAPI spec: list routes return bare arrays,
 * clients are `LabTech.Models.Client` (PhoneNumber/FaxNumber, no counts or
 * IsActive), and locations reference their client as a nested `Client`.
 */

export const list = [
  {
    Id: 100,
    Name: 'Acme Corporation',
    Company: 'Acme Corporation',
    Address1: '123 Main Street',
    City: 'New York',
    State: 'NY',
    ZipCode: '10001',
    Country: 'USA',
    PhoneNumber: '555-123-4567',
    ExternalId: 'CRM-ACME-001',
  },
  {
    Id: 101,
    Name: 'TechStart Inc.',
    Company: 'TechStart Inc.',
    Address1: '456 Innovation Drive',
    City: 'San Francisco',
    State: 'CA',
    ZipCode: '94102',
    Country: 'USA',
    PhoneNumber: '555-987-6543',
    ExternalId: '',
  },
];

export const single = {
  Id: 100,
  Name: 'Acme Corporation',
  Company: 'Acme Corporation',
  FirstName: 'Jane',
  LastName: 'Doe',
  Address1: '123 Main Street',
  Address2: 'Suite 500',
  City: 'New York',
  State: 'NY',
  ZipCode: '10001',
  Country: 'USA',
  PhoneNumber: '555-123-4567',
  FaxNumber: '555-123-4568',
  Comment: 'Premium customer',
  ExternalId: 'CRM-ACME-001',
  UsesInHouseSupportStaff: false,
  NewTicketNotificationEmail: 'support@acme.example',
  IsHiddenFromAllInclusiveGroup: false,
};

export const created = {
  Id: 102,
  Name: 'New Customer Corp',
  Address1: '789 Business Park',
  City: 'Chicago',
  State: 'IL',
  ZipCode: '60601',
  Country: 'USA',
};

export const updated = {
  ...single,
  Name: 'Acme Corporation Updated',
  Comment: 'Updated company info',
};

export const locations = [
  {
    Id: 1,
    LocationId: 1,
    Name: 'Headquarters',
    Client: { Id: 100, Name: 'Acme Corporation' },
    Address1: '123 Main Street',
    City: 'New York',
    State: 'NY',
    ZipCode: '10001',
    ExtraFields: [],
  },
  {
    Id: 2,
    LocationId: 2,
    Name: 'Branch Office',
    Client: { Id: 100, Name: 'Acme Corporation' },
    Address1: '456 Side Street',
    City: 'Brooklyn',
    State: 'NY',
    ZipCode: '11201',
    ExtraFields: [],
  },
];

export const singleLocation = {
  Id: 1,
  Name: 'Headquarters',
  Client: { Id: 100, Name: 'Acme Corporation' },
  Address1: '123 Main Street',
  Address2: 'Suite 500',
  City: 'New York',
  State: 'NY',
  ZipCode: '10001',
  Country: 'USA',
  PhoneNumber: '555-123-4567',
  Comments: 'Main office',
  ProbeId: 0,
  ExternalId: 0,
};
