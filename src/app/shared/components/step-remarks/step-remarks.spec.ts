import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { signal } from '@angular/core';
import { StepRemarksComponent } from './step-remarks';
import { parseStepRemarks } from '../../../core/utils/remark.utils';

describe('StepRemarksComponent', () => {
  it('should extract initials cleanly from name', () => {
    const comp = Object.create(StepRemarksComponent.prototype);
    expect(comp.extractInitials('John Doe')).toBe('JD');
    expect(comp.extractInitials('Single')).toBe('SI');
    expect(comp.extractInitials('')).toBe('TM');
  });

  it('should parse array of string remarks', () => {
    const parsed = parseStepRemarks([
      'Urgent delivery required',
      'Follow-up with supplier needed',
    ]);
    expect(parsed.length).toBe(2);
    expect(parsed[0].text).toBe('Urgent delivery required');
    expect(parsed[1].text).toBe('Follow-up with supplier needed');
  });

  it('should parse array of remark objects', () => {
    const parsed = parseStepRemarks([
      { id: '1', remark: 'Urgent delivery required', created_at: '2026-09-24T10:00:00Z' },
    ]);
    expect(parsed.length).toBe(1);
    expect(parsed[0].text).toBe('Urgent delivery required');
  });

  it('should parse legacy plain text remark', () => {
    const parsed = parseStepRemarks('Need material sample first');
    expect(parsed.length).toBe(1);
    expect(parsed[0].text).toBe('Need material sample first');
  });

  it('should emit quickAdd event when adding from card mode', () => {
    const comp = Object.create(StepRemarksComponent.prototype);
    comp.newText = signal('New quick note');
    comp.loading = signal(false);
    comp.quickAdd = { emit: vi.fn() };

    comp.onAddQuick();

    expect(comp.quickAdd.emit).toHaveBeenCalledWith('New quick note');
    expect(comp.newText()).toBe('');
  });

  it('should emit remarksChange when adding in dialog mode', () => {
    const comp = Object.create(StepRemarksComponent.prototype);
    comp.newText = signal('Dialog note 1');
    comp.parsedRemarks = signal([]);
    comp.remarksChange = { emit: vi.fn() };

    comp.onAddDialog();

    expect(comp.remarksChange.emit).toHaveBeenCalled();
    const emitted = comp.remarksChange.emit.mock.calls[0][0];
    expect(emitted.length).toBe(1);
    expect(emitted[0].text).toBe('Dialog note 1');
    expect(comp.newText()).toBe('');
  });

  it('should emit remarksChange when removing in dialog mode', () => {
    const comp = Object.create(StepRemarksComponent.prototype);
    comp.parsedRemarks = signal([
      { id: '1', text: 'Remark 1', sequence: 1 },
      { id: '2', text: 'Remark 2', sequence: 2 },
    ]);
    comp.remarksChange = { emit: vi.fn() };

    comp.onRemoveDialog(0);

    expect(comp.remarksChange.emit).toHaveBeenCalled();
    const emitted = comp.remarksChange.emit.mock.calls[0][0];
    expect(emitted.length).toBe(1);
    expect(emitted[0].id).toBe('2');
  });
});
