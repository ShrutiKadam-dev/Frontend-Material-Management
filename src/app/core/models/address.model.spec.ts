import { describe, expect, it } from 'vitest';

import {
  formatStructuredAddress,
  lookupCityLocation,
  parseAddressString,
  StructuredAddress,
} from './address.model';

describe('Address Utilities', () => {
  describe('formatStructuredAddress', () => {
    it('should format all fields correctly into standard postal format', () => {
      const addr: StructuredAddress = {
        street: 'Plot 42, Sector 18, MIDC',
        area: 'Near Turbhe Station',
        city: 'Navi Mumbai',
        state: 'Maharashtra',
        pincode: '400705',
        country: 'India',
      };

      const formatted = formatStructuredAddress(addr);
      expect(formatted).toBe(
        'Plot 42, Sector 18, MIDC, Near Turbhe Station, Navi Mumbai, Maharashtra - 400705, India',
      );
    });

    it('should handle optional area field when empty', () => {
      const addr: StructuredAddress = {
        street: '123 Tech Park',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
        country: 'India',
      };

      const formatted = formatStructuredAddress(addr);
      expect(formatted).toBe('123 Tech Park, Bengaluru, Karnataka - 560001, India');
    });

    it('should format address without country when country is omitted', () => {
      const addr: Partial<StructuredAddress> = {
        street: '456 Industrial Way',
        city: 'Ahmedabad',
        state: 'Gujarat',
        pincode: '380001',
      };

      const formatted = formatStructuredAddress(addr);
      expect(formatted).toBe('456 Industrial Way, Ahmedabad, Gujarat - 380001');
    });
  });

  describe('parseAddressString', () => {
    it('should parse a formatted comma-separated address with PIN and state', () => {
      const raw =
        'Plot 42, Sector 18, MIDC, Near Turbhe Station, Navi Mumbai, Maharashtra - 400705, India';
      const parsed = parseAddressString(raw);

      expect(parsed.country).toBe('India');
      expect(parsed.pincode).toBe('400705');
      expect(parsed.state).toBe('Maharashtra');
      expect(parsed.city).toBe('Navi Mumbai');
      expect(parsed.area).toBe('Near Turbhe Station');
      expect(parsed.street).toBe('Plot 42, Sector 18, MIDC');
    });

    it('should parse address and strip embedded POC metadata cleanly', () => {
      const raw =
        'Plot 42, Turbhe, Navi Mumbai, Maharashtra - 400705, India\n---\nPOCs:[{"name":"Rajesh","email":"rajesh@test.com","contact_number":"9876543210"}]';
      const parsed = parseAddressString(raw);

      expect(parsed.country).toBe('India');
      expect(parsed.pincode).toBe('400705');
      expect(parsed.state).toBe('Maharashtra');
      expect(parsed.city).toBe('Navi Mumbai');
      expect(parsed.area).toBe('Turbhe');
      expect(parsed.street).toBe('Plot 42');
    });

    it('should parse JSON-formatted string', () => {
      const raw = JSON.stringify({
        street: 'Floor 8, Tower B',
        area: 'Cyber City',
        city: 'Gurgaon',
        state: 'Haryana',
        pincode: '122002',
        country: 'India',
      });

      const parsed = parseAddressString(raw);
      expect(parsed.street).toBe('Floor 8, Tower B');
      expect(parsed.area).toBe('Cyber City');
      expect(parsed.city).toBe('Gurgaon');
      expect(parsed.state).toBe('Haryana');
      expect(parsed.pincode).toBe('122002');
      expect(parsed.country).toBe('India');
    });

    it('should handle legacy unstructured single string safely with empty country', () => {
      const raw = 'Simple Street Only';
      const parsed = parseAddressString(raw);

      expect(parsed.street).toBe('Simple Street Only');
      expect(parsed.city).toBe('');
      expect(parsed.country).toBe('');
    });

    it('should handle null or undefined gracefully', () => {
      const parsedNull = parseAddressString(null);
      expect(parsedNull.street).toBe('');
      expect(parsedNull.country).toBe('');

      const parsedUndefined = parseAddressString(undefined);
      expect(parsedUndefined.street).toBe('');
      expect(parsedUndefined.country).toBe('');
    });
  });

  describe('lookupCityLocation', () => {
    it('should find exact city match and return state and country', () => {
      const match = lookupCityLocation('Mumbai');
      expect(match).toEqual({ state: 'Maharashtra', country: 'India' });
    });

    it('should handle case-insensitive city search', () => {
      const match = lookupCityLocation('pune');
      expect(match).toEqual({ state: 'Maharashtra', country: 'India' });
    });

    it('should find Delhi and NCR cities', () => {
      const delhi = lookupCityLocation('New Delhi');
      expect(delhi).toEqual({ state: 'Delhi', country: 'India' });

      const gurgaon = lookupCityLocation('Gurgaon');
      expect(gurgaon).toEqual({ state: 'Haryana', country: 'India' });

      const noida = lookupCityLocation('Noida');
      expect(noida).toEqual({ state: 'Uttar Pradesh', country: 'India' });
    });

    it('should find international cities', () => {
      const dubai = lookupCityLocation('Dubai');
      expect(dubai).toEqual({ state: 'Dubai', country: 'United Arab Emirates' });
    });

    it('should return null for unknown or empty input', () => {
      expect(lookupCityLocation('')).toBeNull();
      expect(lookupCityLocation(null)).toBeNull();
      expect(lookupCityLocation('UnknownCity123')).toBeNull();
    });
  });
});

