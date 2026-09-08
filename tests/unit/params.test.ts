/**
 * Query-parameter and PATCH-body construction tests.
 */

import { describe, it, expect } from 'vitest';
import { buildBaseListParams, toPatchOperations } from '../../src/params.js';

describe('buildBaseListParams', () => {
  it('returns an empty object for no params', () => {
    expect(buildBaseListParams()).toEqual({});
    expect(buildBaseListParams({})).toEqual({});
  });

  it('maps every shared list param onto the Automate query-parameter names', () => {
    expect(
      buildBaseListParams({
        pageSize: 50,
        page: 2,
        condition: "ComputerName like '%web%'",
        orderBy: 'ComputerName asc',
        expand: 'Client',
        includeFields: 'Id,ComputerName',
        excludeFields: 'Comment',
        ids: '1,2,3',
      })
    ).toEqual({
      pageSize: 50,
      page: 2,
      condition: "ComputerName like '%web%'",
      orderBy: 'ComputerName asc',
      expand: 'Client',
      includeFields: 'Id,ComputerName',
      excludeFields: 'Comment',
      ids: '1,2,3',
    });
  });

  it('omits undefined values', () => {
    expect(buildBaseListParams({ page: 1, condition: undefined })).toEqual({ page: 1 });
  });
});

describe('toPatchOperations', () => {
  it('emits one replace op per defined key with a JSON-pointer path', () => {
    expect(toPatchOperations({ Name: 'Acme', Phone: '555', Comment: undefined, Active: false })).toEqual([
      { Op: 'replace', Path: '/Name', Value: 'Acme' },
      { Op: 'replace', Path: '/Phone', Value: '555' },
      { Op: 'replace', Path: '/Active', Value: false },
    ]);
  });

  it('keeps null values (an explicit clear)', () => {
    expect(toPatchOperations({ Comment: null })).toEqual([{ Op: 'replace', Path: '/Comment', Value: null }]);
  });

  it('returns an empty array for an empty partial', () => {
    expect(toPatchOperations({})).toEqual([]);
  });
});
