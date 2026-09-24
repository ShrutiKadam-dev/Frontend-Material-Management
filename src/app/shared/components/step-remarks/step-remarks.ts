import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { StepRemarkItem } from '../../../core/models/step-remark.model';
import { parseStepRemarks } from '../../../core/utils/remark.utils';

@Component({
  selector: 'app-step-remarks',
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    InputTextModule,
    TooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mode() === 'card') {
    <div class="remarks-card-section" [attr.aria-label]="title()">
      <p class="qe-section-title">
        <i class="pi pi-comments" aria-hidden="true"></i>
        {{ title() }} ({{ parsedRemarks().length }})
      </p>

      <!-- Remarks Timeline Stream / Sequence -->
      <div class="remarks-timeline">
        @if (parsedRemarks().length === 0) {
        <div class="empty-remarks-hint">
          <i class="pi pi-comment" aria-hidden="true"></i>
          <span>No remarks recorded yet. Add an initial remark below.</span>
        </div>
        } @else {
        <div class="timeline-sequence">
          @for (rmk of parsedRemarks(); track rmk.id; let last = $last) {
          <div class="timeline-item" [class.timeline-item--last]="last">
            <div class="timeline-indicator">
              <span class="timeline-dot" aria-hidden="true"></span>
              @if (!last) {
              <span class="timeline-stem" aria-hidden="true"></span>
              }
            </div>
            <div class="timeline-entry">
              <div class="timeline-meta-bar">
                <span class="timeline-timestamp">
                  <i class="pi pi-clock" aria-hidden="true"></i>
                  {{ rmk.created_at | date: 'dd-MM-yyyy, hh:mm a' }}
                </span>
                @if (canDelete()) {
                <button type="button" class="timeline-delete-btn" pTooltip="Delete remark" tooltipPosition="left"
                  [attr.aria-label]="'Delete remark from ' + (rmk.created_at | date: 'dd-MM-yyyy')"
                  (click)="onDeleteQuick(rmk.id)">
                  <i class="pi pi-trash" aria-hidden="true"></i>
                </button>
                }
              </div>
              <div class="timeline-text">
                {{ rmk.text }}
              </div>
            </div>
          </div>
          }
        </div>
        }
      </div>

      <!-- Quick Add Remark Box -->
      @if (canAdd()) {
      <div class="quick-remark-bar">
        <input pInputText type="text" [(ngModel)]="newText" [placeholder]="placeholder()"
          class="quick-remark-input" (keydown.enter)="$event.preventDefault(); onAddQuick()" />
        <button pButton type="button" icon="pi pi-plus" [label]="buttonLabel()"
          class="p-button-sm quick-remark-btn" [loading]="loading()"
          [disabled]="!newText().trim() || loading()"
          (click)="onAddQuick()"></button>
      </div>
      }
    </div>
    } @else {
    <!-- Dialog Mode -->
    <div class="dlg-section">
      <div class="dlg-section-header">
        <p class="dlg-section-label">
          <i class="pi pi-comments"></i> {{ sectionNumber() ? (sectionNumber() + '. ') : '' }}{{ title() }}
        </p>
        <span class="card-count-badge">
          {{ parsedRemarks().length }} {{ parsedRemarks().length === 1 ? 'remark' : 'remarks' }}
        </span>
      </div>

      @if (parsedRemarks().length > 0) {
      <div class="dlg-timeline-sequence">
        @for (rmk of parsedRemarks(); track rmk.id; let i = $index; let last = $last) {
        <div class="timeline-item" [class.timeline-item--last]="last">
          <div class="timeline-indicator">
            <span class="timeline-dot" aria-hidden="true"></span>
            @if (!last) {
            <span class="timeline-stem" aria-hidden="true"></span>
            }
          </div>
          <div class="timeline-entry">
            <div class="timeline-meta-bar">
              <span class="timeline-timestamp">
                <i class="pi pi-clock" aria-hidden="true"></i>
                {{ rmk.created_at | date: 'dd-MM-yyyy, hh:mm a' }}
              </span>
              <button type="button" class="dlg-remark-remove" [attr.aria-label]="'Remove remark ' + (i + 1)"
                pTooltip="Remove remark" tooltipPosition="top" (click)="onRemoveDialog(i)">
                <i class="pi pi-times" aria-hidden="true"></i>
              </button>
            </div>
            <div class="timeline-text">
              {{ rmk.text }}
            </div>
          </div>
        </div>
        }
      </div>
      }

      <div class="dlg-add-remark-row">
        <input pInputText type="text" [(ngModel)]="newText"
          placeholder="Type note or remark and press Enter or click Add…" class="dlg-remark-input"
          (keydown.enter)="$event.preventDefault(); onAddDialog()" />
        <button pButton type="button" icon="pi pi-plus" label="Add" class="p-button-sm dlg-add-remark-btn"
          [disabled]="!newText().trim()" (click)="onAddDialog()"></button>
      </div>
    </div>
    }
  `,
})
export class StepRemarksComponent {
  readonly mode = input<'card' | 'dialog'>('card');
  readonly remarks = input<unknown>([]);
  readonly defaultDate = input<string | undefined>(undefined);
  readonly title = input<string>('Remarks & Notes');
  readonly sectionNumber = input<string | number | undefined>(undefined);
  readonly placeholder = input<string>('Add a new remark or note…');
  readonly buttonLabel = input<string>('Add Remark');
  readonly canAdd = input<boolean>(true);
  readonly canDelete = input<boolean>(true);
  readonly loading = input<boolean>(false);

  readonly quickAdd = output<string>();
  readonly deleteRemark = output<string>();
  readonly remarksChange = output<StepRemarkItem[]>();

  protected readonly newText = signal<string>('');

  readonly parsedRemarks = computed<StepRemarkItem[]>(() => {
    return parseStepRemarks(this.remarks(), this.defaultDate());
  });

  protected onAddQuick(): void {
    const text = this.newText().trim();
    if (!text || this.loading()) return;
    this.quickAdd.emit(text);
    this.newText.set('');
  }

  protected onDeleteQuick(id: string): void {
    this.deleteRemark.emit(id);
  }

  protected onAddDialog(): void {
    const text = this.newText().trim();
    if (!text) return;
    const current = this.parsedRemarks();
    const newItem: StepRemarkItem = {
      id: `rmk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text,
      created_at: new Date().toISOString(),
    };
    const updated = [...current, newItem];
    this.remarksChange.emit(updated);
    this.newText.set('');
  }

  protected onRemoveDialog(index: number): void {
    const current = this.parsedRemarks();
    const updated = current.filter((_, i) => i !== index);
    this.remarksChange.emit(updated);
  }

  /**
   * Helper method to drain any non-empty input if user directly submits dialog
   */
  public flushPendingDialogRemark(): StepRemarkItem | null {
    const text = this.newText().trim();
    if (!text) return null;
    const newItem: StepRemarkItem = {
      id: `rmk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text,
      created_at: new Date().toISOString(),
    };
    this.newText.set('');
    return newItem;
  }
}
