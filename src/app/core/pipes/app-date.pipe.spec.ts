import { describe, expect, it } from 'vitest';
import { AppDatePipe } from './app-date.pipe';

describe('AppDatePipe', () => {
  const pipe = new AppDatePipe();

  it('should transform DD-MM-YYYY string safely', () => {
    expect(pipe.transform('16-05-2025')).toBe('16-05-2025');
  });

  it('should transform YYYY-MM-DD string to DD-MM-YYYY', () => {
    expect(pipe.transform('2025-05-16')).toBe('16-05-2025');
  });

  it('should transform ISO datetime string to DD-MM-YYYY', () => {
    expect(pipe.transform('2026-09-22T03:46:19.783392')).toBe('22-09-2026');
  });

  it('should transform Date object to DD-MM-YYYY', () => {
    expect(pipe.transform(new Date(2025, 4, 16))).toBe('16-05-2025');
  });

  it('should handle null and undefined gracefully', () => {
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform(undefined)).toBe('—');
  });

  it('should support custom formats', () => {
    expect(pipe.transform('16-05-2025', 'd MMMM yyyy')).toBe('16 May 2025');
  });
});
