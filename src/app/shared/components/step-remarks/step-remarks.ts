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
import { createStepRemarkItem, parseStepRemarks } from '../../../core/utils/remark.utils';

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
      <div class="chat-section-header">
        <p class="qe-section-title">
          <i class="pi pi-history" aria-hidden="true"></i>
          {{ title() }}
        </p>
        <span class="chat-count-pill">{{ parsedRemarks().length }}</span>
      </div>

      <!-- Remarks Timeline Stream (Content First) -->
      <div class="remarks-timeline">
        @if (parsedRemarks().length === 0) {
        <div class="empty-remarks-hint">
          <i class="pi pi-history" aria-hidden="true"></i>
          <span>No remarks recorded yet. Enter a note or observation in the box below to start the timeline.</span>
        </div>
        } @else {
        <div class="timeline-sequence">
          @for (rmk of parsedRemarks(); track rmk.id; let isLast = $last) {
          <div class="timeline-item" [class.timeline-item--last]="isLast">
            <div class="timeline-indicator" aria-hidden="true">
              <span class="timeline-dot"></span>
              @if (!isLast) {
              <span class="timeline-stem"></span>
              }
            </div>
            <div class="timeline-entry">
              <div class="timeline-meta-bar">
                <div class="timeline-meta-info">
                  <span class="timeline-author">
                    <i class="pi pi-user" aria-hidden="true"></i>
                    {{ rmk.user || 'Team Member' }}
                  </span>
                  <span class="timeline-timestamp">
                    <i class="pi pi-clock" aria-hidden="true"></i>
                    {{ safeDate(rmk.created_at) | date: 'dd-MM-yyyy, hh:mm a' }}
                  </span>
                </div>
                @if (canDelete()) {
                <button type="button" class="timeline-delete-btn" pTooltip="Delete remark" tooltipPosition="left"
                  [attr.aria-label]="'Delete remark from ' + (safeDate(rmk.created_at) | date: 'dd-MM-yyyy')"
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

      <!-- Quick Add Remark Box (Bottom Type Box) -->
      @if (canAdd()) {
      <div class="chat-typebox-bar">
        <input pInputText type="text" [(ngModel)]="newText" [placeholder]="placeholder()"
          class="chat-typebox-input" (keydown.enter)="$event.preventDefault(); onAddQuick()" />
        <button pButton type="button" icon="pi pi-send" [label]="buttonLabel()"
          class="chat-typebox-btn" [loading]="loading()"
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
          <i class="pi pi-history"></i> {{ sectionNumber() ? (sectionNumber() + '. ') : '' }}{{ title() }}
        </p>
        <span class="card-count-badge">
          {{ parsedRemarks().length }} {{ parsedRemarks().length === 1 ? 'remark' : 'remarks' }}
        </span>
      </div>

      <!-- Remarks Timeline Stream (Content First) -->
      <div class="dlg-timeline-sequence">
        @if (parsedRemarks().length === 0) {
        <div class="empty-remarks-hint">
          <i class="pi pi-history" aria-hidden="true"></i>
          <span>No remarks recorded yet. Enter a note or observation in the box below to start the timeline.</span>
        </div>
        } @else {
        <div class="timeline-sequence">
          @for (rmk of parsedRemarks(); track rmk.id; let i = $index; let isLast = $last) {
          <div class="timeline-item" [class.timeline-item--last]="isLast">
            <div class="timeline-indicator" aria-hidden="true">
              <span class="timeline-dot"></span>
              @if (!isLast) {
              <span class="timeline-stem"></span>
              }
            </div>
            <div class="timeline-entry">
              <div class="timeline-meta-bar">
                <div class="timeline-meta-info">
                  <span class="timeline-author">
                    <i class="pi pi-user" aria-hidden="true"></i>
                    {{ rmk.user || 'Team Member' }}
                  </span>
                  <span class="timeline-timestamp">
                    <i class="pi pi-clock" aria-hidden="true"></i>
                    {{ safeDate(rmk.created_at) | date: 'dd-MM-yyyy, hh:mm a' }}
                  </span>
                </div>
                <button type="button" class="timeline-delete-btn" [attr.aria-label]="'Remove remark ' + (i + 1)"
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
      </div>

      <!-- Bottom Type Box -->
      <div class="chat-typebox-bar">
        <input pInputText type="text" [(ngModel)]="newText"
          placeholder="Type note or remark and press Enter to send…" class="chat-typebox-input"
          (keydown.enter)="$event.preventDefault(); onAddDialog()" />
        <button pButton type="button" icon="pi pi-send" label="Send" class="chat-typebox-btn"
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

  protected extractInitials(name?: string): string {
    if (!name) return 'TM';
    const clean = name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (name[0] || 'T').toUpperCase();
  }

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
    const newItem = createStepRemarkItem(text);
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
    const newItem = createStepRemarkItem(text);
    this.newText.set('');
    return newItem;
  }

  protected safeDate(val?: string | Date | null): Date | null {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    const str = String(val).trim();
    if (!str) return null;
    const matchDmy = str.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
    if (matchDmy) {
      const day = parseInt(matchDmy[1], 10);
      const month = parseInt(matchDmy[2], 10) - 1;
      const year = parseInt(matchDmy[3], 10);
      const d = new Date(year, month, day);
      return !isNaN(d.getTime()) ? d : null;
    }
    const d = new Date(str);
    return !isNaN(d.getTime()) ? d : null;
  }
}
