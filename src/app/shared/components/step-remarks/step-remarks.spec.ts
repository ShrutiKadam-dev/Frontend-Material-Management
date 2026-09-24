import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StepRemarksComponent } from './step-remarks';

describe('StepRemarksComponent', () => {
  let component: StepRemarksComponent;
  let fixture: ComponentFixture<StepRemarksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StepRemarksComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StepRemarksComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should parse array of remark objects and display in timeline', () => {
    fixture.componentRef.setInput('remarks', [
      { id: '1', remark: 'Urgent delivery required', created_at: '2026-09-24T10:00:00Z' },
    ]);
    fixture.detectChanges();

    expect(component.parsedRemarks().length).toBe(1);
    expect(component.parsedRemarks()[0].text).toBe('Urgent delivery required');
  });

  it('should parse legacy plain text remark', () => {
    fixture.componentRef.setInput('remarks', 'Need material sample first');
    fixture.detectChanges();

    expect(component.parsedRemarks().length).toBe(1);
    expect(component.parsedRemarks()[0].text).toBe('Need material sample first');
  });

  it('should emit quickAdd event when adding from card', () => {
    const spy = vi.fn();
    component.quickAdd.subscribe(spy);

    component['newText'].set('New quick note');
    component['onAddQuick']();

    expect(spy).toHaveBeenCalledWith('New quick note');
    expect(component['newText']()).toBe('');
  });

  it('should emit remarksChange when adding in dialog mode', () => {
    fixture.componentRef.setInput('mode', 'dialog');
    fixture.componentRef.setInput('remarks', []);
    fixture.detectChanges();

    const spy = vi.fn();
    component.remarksChange.subscribe(spy);

    component['newText'].set('Dialog note 1');
    component['onAddDialog']();

    expect(spy).toHaveBeenCalled();
    const emitted = spy.mock.calls[0][0];
    expect(emitted.length).toBe(1);
    expect(emitted[0].text).toBe('Dialog note 1');
  });
});
