import { describe, expect, it } from 'vitest';
import {
  hasSubstantiveRecordData,
  isApiErrorEnvelope,
  unwrapLatestApiRecord,
} from './api-response.utils';

describe('api-response.utils', () => {
  it('should detect API error envelopes such as NOT_FOUND with success: false', () => {
    expect(
      isApiErrorEnvelope({
        error: {
          code: 'NOT_FOUND',
          message: 'Pre-qualification bid not found.',
        },
        success: false,
      }),
    ).toBe(true);

    expect(isApiErrorEnvelope({ success: false })).toBe(true);
    expect(isApiErrorEnvelope({ error: 'Not found' })).toBe(true);
    expect(isApiErrorEnvelope({ errors: ['missing'] })).toBe(true);
    expect(isApiErrorEnvelope({ success: true, id: 1 })).toBe(false);
  });

  it('should return null from unwrapLatestApiRecord on error envelopes, null data, or empty records', () => {
    expect(
      unwrapLatestApiRecord({
        error: {
          code: 'NOT_FOUND',
          message: 'Pre-qualification bid not found.',
        },
        success: false,
      }),
    ).toBeNull();

    expect(unwrapLatestApiRecord({ success: true, data: null })).toBeNull();
    expect(unwrapLatestApiRecord({ data: null })).toBeNull();
    expect(unwrapLatestApiRecord({ data: [] })).toBeNull();
    expect(unwrapLatestApiRecord({ data: {} })).toBeNull();
    expect(unwrapLatestApiRecord([])).toBeNull();
    expect(unwrapLatestApiRecord({})).toBeNull();
    expect(unwrapLatestApiRecord({ message: 'Not found', status: 404 })).toBeNull();
    expect(unwrapLatestApiRecord(null)).toBeNull();
    expect(unwrapLatestApiRecord(undefined)).toBeNull();
  });

  it('should unwrap valid latest API records including data wrappers and JSON strings', () => {
    expect(
      unwrapLatestApiRecord({
        success: true,
        data: { id: 12, pqb_no: 'PQB-101', pqb_title: 'Grid Upgrade' },
      }),
    ).toEqual({ id: 12, pqb_no: 'PQB-101', pqb_title: 'Grid Upgrade' });

    expect(
      unwrapLatestApiRecord({
        id: 5,
        project_id: 20,
        data: JSON.stringify({ pqb_title: 'Grid Overhaul PQB', pqb_no: 'GRID-PQB-77' }),
      }),
    ).toEqual({
      id: 5,
      project_id: 20,
      pqb_title: 'Grid Overhaul PQB',
      pqb_no: 'GRID-PQB-77',
    });

    expect(unwrapLatestApiRecord([{ id: 3, tender_title: 'LTE Title' }])).toEqual({
      id: 3,
      tender_title: 'LTE Title',
    });

    expect(hasSubstantiveRecordData({ pqb_no: 'PQB-1' })).toBe(true);
    expect(hasSubstantiveRecordData({ items: [] })).toBe(false);
  });
});
