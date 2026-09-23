import { describe, expect, it } from 'vitest';
import {
  extractEntityPocs,
  extractNameAndNickname,
  formatAddressWithPocs,
  formatNameWithNickname,
  getCleanAddress,
  PointOfContact,
} from './contact.model';

describe('Contact & Nickname Utilities', () => {
  describe('extractNameAndNickname', () => {
    it('should parse nickname enclosed in square brackets', () => {
      const result = extractNameAndNickname('Tata Motors Limited [TML]');
      expect(result.name).toBe('Tata Motors Limited');
      expect(result.nickname).toBe('TML');
    });

    it('should parse nickname enclosed in parentheses', () => {
      const result = extractNameAndNickname('Larsen & Toubro (L&T)');
      expect(result.name).toBe('Larsen & Toubro');
      expect(result.nickname).toBe('L&T');
    });

    it('should handle name without nickname', () => {
      const result = extractNameAndNickname('Pasaban S.A.');
      expect(result.name).toBe('Pasaban S.A.');
      expect(result.nickname).toBe('');
    });

    it('should handle null or undefined safely', () => {
      expect(extractNameAndNickname(null)).toEqual({ name: '', nickname: '' });
      expect(extractNameAndNickname(undefined)).toEqual({ name: '', nickname: '' });
    });
  });

  describe('formatNameWithNickname', () => {
    it('should format company name with bracketed nickname', () => {
      expect(formatNameWithNickname('Tata Motors', 'TML')).toBe('Tata Motors [TML]');
    });

    it('should return plain name if nickname is empty or whitespace', () => {
      expect(formatNameWithNickname('Tata Motors', '')).toBe('Tata Motors');
      expect(formatNameWithNickname('Tata Motors', '   ')).toBe('Tata Motors');
      expect(formatNameWithNickname('Tata Motors', null)).toBe('Tata Motors');
    });
  });

  describe('formatAddressWithPocs and getCleanAddress', () => {
    it('should encode POCs into persistent address string', () => {
      const pocs: PointOfContact[] = [
        {
          name: 'Rajesh Sharma',
          email: 'rajesh@test.com',
          contact_number: '9876543210',
          designation: 'Procurement Lead',
        },
      ];
      const encoded = formatAddressWithPocs('MIDC, Pune, Maharashtra - 411018, India', pocs);
      expect(encoded).toContain('MIDC, Pune, Maharashtra - 411018, India');
      expect(encoded).toContain('\n---\nPOCs:');
      expect(encoded).toContain('Rajesh Sharma');

      expect(getCleanAddress(encoded)).toBe('MIDC, Pune, Maharashtra - 411018, India');
    });

    it('should return clean address if POCs array is empty', () => {
      const raw = 'Simple Road, City';
      expect(formatAddressWithPocs(raw, [])).toBe('Simple Road, City');
      expect(getCleanAddress(raw)).toBe('Simple Road, City');
    });
  });

  describe('extractEntityPocs', () => {
    it('should extract POCs from embedded address metadata', () => {
      const pocs: PointOfContact[] = [
        {
          name: 'Sunita Rao',
          email: 'sunita@test.com',
          contact_number: '+91 9876543211',
          designation: 'Finance',
        },
      ];
      const raw = formatAddressWithPocs('123 Street, Pune', pocs);
      const extracted = extractEntityPocs(raw, 'fallback@test.com', '12345', 'Acme');

      expect(extracted.length).toBe(1);
      expect(extracted[0].name).toBe('Sunita Rao');
      expect(extracted[0].email).toBe('sunita@test.com');
      expect(extracted[0].contact_number).toBe('+91 9876543211');
      expect(extracted[0].designation).toBe('Finance');
    });

    it('should fallback to entity email/phone if address has no embedded POCs', () => {
      const extracted = extractEntityPocs(
        'Simple Address',
        'ops@company.com',
        '8805903875',
        'Company [COMP]',
      );
      expect(extracted.length).toBe(1);
      expect(extracted[0].name).toBe('Company Contact');
      expect(extracted[0].email).toBe('ops@company.com');
      expect(extracted[0].contact_number).toBe('8805903875');
    });
  });
});
