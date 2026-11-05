import { beforeEach, describe, expect, it } from 'vitest';
import {
  BillingConfig,
  capitalizeProject,
  classifyEpic,
  DEFAULT_BILLING_CONFIG,
  loadBillingConfig,
  saveBillingConfig,
} from './billingConfig';

// A company that tags billable epics with "ACME" + 5 digits and has two internal projects.
const acme: BillingConfig = {
  codePrefix: 'ACME',
  codeDigits: 5,
  internalProjects: ['Platform Development', ' internal time '],
};

describe('classifyEpic with billing codes', () => {
  it('extracts the code from the epic title, case-insensitively', () => {
    expect(classifyEpic('New checkout acme01234', 'big client', acme)).toEqual({
      project: 'Big Client',
      code: 'ACME01234',
      missingCode: false,
    });
  });

  it('requires the configured number of digits', () => {
    expect(classifyEpic('Epic ACME1234', 'Client', acme).missingCode).toBe(true);
  });

  it('groups internal projects or epics without a code under Internal Time', () => {
    const expected = { project: 'Internal Time', code: '', missingCode: false };
    expect(classifyEpic('Anything', 'PLATFORM development', acme)).toEqual(expected);
    expect(classifyEpic('Internal Time', 'Client', acme)).toEqual(expected);
  });

  it('keeps an internal project billable when its epic has a code', () => {
    expect(classifyEpic('Epic ACME00001', 'Platform Development', acme).code).toBe('ACME00001');
  });

  // Billable epics without a code must be flagged, or they end up on the invoice untagged.
  it('flags billable epics without a code and uses a placeholder', () => {
    expect(classifyEpic('No Epic', 'client', acme)).toEqual({
      project: 'Client',
      code: 'ACME?????',
      missingCode: true,
    });
  });
});

describe('classifyEpic without billing codes (default)', () => {
  it('groups by project and never flags missing codes', () => {
    expect(classifyEpic('Epic ACME01234', 'client', DEFAULT_BILLING_CONFIG)).toEqual({
      project: 'Client',
      code: '',
      missingCode: false,
    });
  });

  it('treats a prefix with regex characters literally', () => {
    const config = { ...DEFAULT_BILLING_CONFIG, codePrefix: 'A.B' };
    expect(classifyEpic('Epic AXB12345', 'c', config).missingCode).toBe(true);
    expect(classifyEpic('Epic A.B12345', 'c', config).code).toBe('A.B12345');
  });
});

describe('capitalizeProject', () => {
  it('keeps the prefix uppercase', () => {
    expect(capitalizeProject('acme mobile APP', acme)).toBe('ACME Mobile App');
    expect(capitalizeProject('acme mobile', DEFAULT_BILLING_CONFIG)).toBe('Acme Mobile');
  });
});

describe('load/saveBillingConfig', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips and falls back to defaults on bad data', () => {
    expect(loadBillingConfig()).toEqual(DEFAULT_BILLING_CONFIG);
    saveBillingConfig(acme);
    expect(loadBillingConfig()).toEqual(acme);
    localStorage.setItem('billing_config', '{not json');
    expect(loadBillingConfig()).toEqual(DEFAULT_BILLING_CONFIG);
    localStorage.setItem('billing_config', JSON.stringify({ codePrefix: 'X', codeDigits: 0 }));
    expect(loadBillingConfig()).toEqual({ codePrefix: 'X', codeDigits: 5, internalProjects: [] });
  });
});
