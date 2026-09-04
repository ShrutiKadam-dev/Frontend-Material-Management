import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { finalize } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';

import { BidSubmissionService } from '../../../../core/services/bid-submission';
import { CustomerTenderService } from '../../../../core/services/customer-tender';
import { CustomerService } from '../../../../core/services/customer';
import { ProjectService } from '../../../../core/services/project';
import { AttachmentService } from '../../../../core/services/attachment';
import {
  INCOTERMS_OPTIONS,
  VALIDITY_UNIT_OPTIONS,
  parseValidity,
} from '../../../../core/constants/dropdown-options.constant';
import {
  BidSubmission,
  BidSubmissionCreateInput,
  BidSubmissionItem,
  BidSubmissionUpdateInput,
} from '../../../../core/models/bid-submission.model';
import { CustomerTender } from '../../../../core/models/customer-tender.model';
import { Attachment } from '../../../../core/models/attachment.model';
import { Customer } from '../../../../core/models/customer.model';
import { Project } from '../../../../core/models/project.model';

@Component({
  selector: 'app-step-07-bid-documents',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    DatePickerModule,
    TooltipModule,
    TableModule,
    SelectModule,
    DatePipe,
    DecimalPipe,
  ],
  templateUrl: './step-07-bid-documents.html',
  styleUrl: './step-07-bid-documents.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step07BidDocuments implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly bidSubmissionService = inject(BidSubmissionService);
  private readonly customerTenderService = inject(CustomerTenderService);
  private readonly customerService = inject(CustomerService);
  private readonly projectService = inject(ProjectService);
  private readonly attachmentService = inject(AttachmentService);
  private readonly messageService = inject(MessageService);

  /* ── Core State Signals ────────────────────────────────── */
  protected readonly projectId = signal(0);
  protected readonly project = signal<Project | null>(null);
  protected readonly customer = signal<Customer | null>(null);
  protected readonly submissions = signal<BidSubmission[]>([]);
  protected readonly latestTender = signal<CustomerTender | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadingTender = signal(false);
  protected readonly submitting = signal(false);
  protected readonly downloadingAttachmentId = signal<number | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly searchQuery = signal('');

  /* ── Dialog State Signals ──────────────────────────────── */
  protected readonly dialogVisible = signal(false);
  protected readonly editingSubmission = signal<BidSubmission | null>(null);
  protected readonly items = signal<BidSubmissionItem[]>([]);
  protected readonly editingItemIndex = signal<number | null>(null);
  protected readonly attachments = signal<File[]>([]);
  protected readonly existingAttachments = signal<Attachment[]>([]);

  /* ── Dropdown Constants ────────────────────────────────── */
  protected readonly incotermsOptions = INCOTERMS_OPTIONS;
  protected readonly validityUnitOptions = VALIDITY_UNIT_OPTIONS;

  /* ── Reactive Forms ────────────────────────────────────── */
  protected readonly headerForm = this.fb.group({
    customer_id: [0],
    customer_tender_id: [0],
    tender_title: ['', [Validators.required, Validators.minLength(2)]],
    tender_number: ['', [Validators.required]],
    submission_date: [null as Date | null, [Validators.required]],
    validity_amount: [''],
    validity_unit: ['Days'],
    delivery_terms: [''],
    delivery_period: [''],
    payment_terms: [''],
    warranty_period: [''],
    remark: [''],
  });

  protected readonly rowForm = this.fb.group({
    material_name: ['', [Validators.required]],
    hsn_sac: [''],
    quantity: ['', [Validators.required, Validators.pattern(/^[0-9]+(\.[0-9]+)?$/)]],
    unit_price: ['', [Validators.pattern(/^[0-9]+(\.[0-9]+)?$/)]],
  });

  /* ── Derived Summaries ─────────────────────────────────── */
  protected readonly filteredSubmissions = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.submissions();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.tender_title?.toLowerCase().includes(q) ||
        s.tender_number?.toLowerCase().includes(q) ||
        s.remark?.toLowerCase().includes(q) ||
        s.delivery_terms?.toLowerCase().includes(q)
    );
  });

  protected readonly totalItemCount = computed(() => {
    return this.submissions().reduce((acc, s) => acc + (s.items?.length || 0), 0);
  });

  protected readonly totalBidValue = computed(() => {
    return this.submissions().reduce((total, s) => {
      const subTotal = (s.items || []).reduce((sum, item) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.unit_price) || 0;
        return sum + qty * price;
      }, 0);
      return total + subTotal;
    }, 0);
  });

  protected readonly dialogTotalValue = computed(() => {
    return this.items().reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      return sum + qty * price;
    }, 0);
  });

  /* ── Lifecycle ─────────────────────────────────────────── */
  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('projectId'));
    if (!id) {
      this.errorMessage.set('Invalid project ID.');
      this.loading.set(false);
      return;
    }
    this.projectId.set(id);
    this.loadProjectDetails(id);
    this.loadSubmissions(id);
    this.loadLatestTender(id);
  }

  /* ── Data Loaders ──────────────────────────────────────── */
  private loadProjectDetails(projectId: number): void {
    this.projectService.getProjectById(projectId).subscribe({
      next: (proj) => {
        this.project.set(proj);
        if (proj?.customer_id) {
          this.customerService.getCustomerById(proj.customer_id).subscribe({
            next: (cust) => this.customer.set(cust),
            error: () => {/* non-fatal */},
          });
        }
      },
      error: () => {/* non-fatal */},
    });
  }

  protected loadSubmissions(projectId: number): void {
    this.loading.set(true);
    this.bidSubmissionService
      .getByProject(projectId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => {
          this.submissions.set(data || []);
        },
        error: () => {
          this.errorMessage.set('Failed to load bid submissions.');
        },
      });
  }

  protected loadLatestTender(projectId: number): void {
    this.loadingTender.set(true);
    this.customerTenderService
      .getLatestByProject(projectId)
      .pipe(finalize(() => this.loadingTender.set(false)))
      .subscribe({
        next: (res) => {
          const tender = Array.isArray(res) ? res[0] : res;
          this.latestTender.set(tender || null);
        },
        error: () => {
          // Fallback to getByProject
          this.customerTenderService.getByProject(projectId).subscribe({
            next: (tenders) => {
              this.latestTender.set(tenders && tenders.length ? tenders[0] : null);
            },
            error: () => {/* non-fatal */},
          });
        },
      });
  }

  /* ── Dialog Management ─────────────────────────────────── */
  protected openCreateDialog(): void {
    const proj = this.project();
    const cust = this.customer();
    const tender = this.latestTender();

    // Map items from latest customer tender if available
    const mappedItems: BidSubmissionItem[] = (tender?.items || []).map((it) => ({
      material_name: it.material_name,
      quantity: it.quantity,
      unit_price: it.unit_price ?? '',
      hsn_sac: (it as any).hsn_sac || (it as any).hsn_code || '',
      net_amount: (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    }));

    const parsedVal = this.parseValidityHelper(tender?.validity);

    this.headerForm.reset({
      customer_id: tender?.customer_id || proj?.customer_id || cust?.id || 0,
      customer_tender_id: tender?.id || 0,
      tender_title: tender?.tender_title || '',
      tender_number: tender?.tender_number || '',
      submission_date: null,
      validity_amount: parsedVal.value,
      validity_unit: parsedVal.unit,
      delivery_terms: tender?.delivery_terms || '',
      delivery_period: tender?.delivery_period || '',
      payment_terms: tender?.payment_terms || '',
      warranty_period: tender?.warranty_period || '',
      remark: '',
    });

    this.items.set(mappedItems);
    this.attachments.set([]);
    this.existingAttachments.set([]);
    this.editingSubmission.set(null);
    this.editingItemIndex.set(null);
    this.rowForm.reset();
    this.errorMessage.set(null);
    this.dialogVisible.set(true);
  }

  protected openEditDialog(sub: BidSubmission): void {
    const parsedVal = this.parseValidityHelper(sub.validity);

    this.headerForm.reset({
      customer_id: sub.customer_id,
      customer_tender_id: sub.customer_tender_id || 0,
      tender_title: sub.tender_title || '',
      tender_number: sub.tender_number || '',
      submission_date: sub.submission_date ? new Date(sub.submission_date) : null,
      validity_amount: parsedVal.value,
      validity_unit: parsedVal.unit,
      delivery_terms: sub.delivery_terms || '',
      delivery_period: sub.delivery_period || '',
      payment_terms: sub.payment_terms || '',
      warranty_period: sub.warranty_period || '',
      remark: sub.remark || '',
    });

    this.items.set(sub.items ? [...sub.items] : []);
    this.attachments.set([]);
    this.existingAttachments.set(sub.attachments ? [...sub.attachments] : []);
    this.editingSubmission.set(sub);
    this.editingItemIndex.set(null);
    this.rowForm.reset();
    this.errorMessage.set(null);
    this.dialogVisible.set(true);
  }

  protected closeDialog(): void {
    this.dialogVisible.set(false);
    this.editingSubmission.set(null);
    this.items.set([]);
    this.attachments.set([]);
    this.existingAttachments.set([]);
    this.editingItemIndex.set(null);
    this.rowForm.reset();
    this.errorMessage.set(null);
  }

  /* ── Line Items Row Management ─────────────────────────── */
  protected openEditRow(index: number, matInput: HTMLInputElement): void {
    const item = this.items()[index];
    if (!item) return;

    this.editingItemIndex.set(index);
    this.rowForm.patchValue({
      material_name: item.material_name,
      hsn_sac: item.hsn_sac || '',
      quantity: String(item.quantity),
      unit_price: item.unit_price ? String(item.unit_price) : '',
    });

    setTimeout(() => matInput.focus(), 50);
  }

  protected saveRow(matInput: HTMLInputElement): void {
    if (this.rowForm.invalid) {
      this.rowForm.markAllAsTouched();
      return;
    }

    const val = this.rowForm.getRawValue();
    const qty = Number(val.quantity) || 0;
    const price = Number(val.unit_price) || 0;
    const net = qty * price;

    const newItem: BidSubmissionItem = {
      material_name: val.material_name.trim(),
      hsn_sac: val.hsn_sac?.trim() || undefined,
      quantity: qty,
      unit_price: val.unit_price ? price : undefined,
      net_amount: net,
    };

    const currentItems = [...this.items()];
    const editIdx = this.editingItemIndex();

    if (editIdx !== null) {
      currentItems[editIdx] = {
        ...currentItems[editIdx],
        ...newItem,
      };
      this.editingItemIndex.set(null);
    } else {
      currentItems.push(newItem);
    }

    this.items.set(currentItems);
    this.rowForm.reset();
    setTimeout(() => matInput.focus(), 50);
  }

  protected cancelRow(): void {
    this.editingItemIndex.set(null);
    this.rowForm.reset();
  }

  protected deleteRow(index: number): void {
    const currentItems = [...this.items()];
    currentItems.splice(index, 1);
    this.items.set(currentItems);

    if (this.editingItemIndex() === index) {
      this.cancelRow();
    }
  }

  /* ── File Management ───────────────────────────────────── */
  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      const newFiles = Array.from(input.files);
      this.attachments.update((current) => [...current, ...newFiles]);
      input.value = '';
    }
  }

  protected removeAttachment(index: number): void {
    this.attachments.update((files) => files.filter((_, i) => i !== index));
  }

  protected downloadAttachment(att: Attachment): void {
    if (!att.id) return;
    this.downloadingAttachmentId.set(att.id);
    this.attachmentService
      .downloadAttachment(att.id)
      .pipe(finalize(() => this.downloadingAttachmentId.set(null)))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = att.file_name || 'document';
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Download Failed',
            detail: `Could not download ${att.file_name}`,
          });
        },
      });
  }

  protected formatFileSize(bytes?: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected getFileIcon(contentType?: string): string {
    if (!contentType) return 'pi pi-file';
    if (contentType.includes('pdf')) return 'pi pi-file-pdf';
    if (contentType.includes('image')) return 'pi pi-image';
    if (contentType.includes('sheet') || contentType.includes('excel'))
      return 'pi pi-file-excel';
    if (contentType.includes('word') || contentType.includes('document'))
      return 'pi pi-file-word';
    return 'pi pi-file';
  }

  /* ── Submission ────────────────────────────────────────── */
  protected submit(): void {
    if (this.headerForm.invalid) {
      this.headerForm.markAllAsTouched();
      return;
    }

    if (this.items().length === 0) {
      this.errorMessage.set('Please add at least one material line item before saving.');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const f = this.headerForm.getRawValue();
    const submissionDateStr = f.submission_date
      ? new Date(f.submission_date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const currentSub = this.editingSubmission();

    const validityStr = f.validity_amount?.trim()
      ? `${f.validity_amount.trim()} ${f.validity_unit || 'Days'}`
      : undefined;

    if (currentSub) {
      const payload: BidSubmissionUpdateInput = {
        customer_id: f.customer_id || this.project()?.customer_id || 0,
        customer_tender_id: f.customer_tender_id || undefined,
        tender_title: f.tender_title.trim(),
        tender_number: f.tender_number.trim(),
        submission_date: submissionDateStr,
        validity: validityStr,
        delivery_terms: f.delivery_terms || undefined,
        delivery_period: f.delivery_period || undefined,
        payment_terms: f.payment_terms || undefined,
        warranty_period: f.warranty_period || undefined,
        remark: f.remark?.trim() || undefined,
        items: this.items(),
      };

      this.bidSubmissionService
        .update(currentSub.id, payload, this.attachments())
        .pipe(finalize(() => this.submitting.set(false)))
        .subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Bid Submission Updated',
              detail: 'Bid documents updated successfully.',
            });
            this.closeDialog();
            this.loadSubmissions(this.projectId());
          },
          error: (err) => {
            this.errorMessage.set(
              err?.error?.message || 'Failed to update bid submission. Please check all fields.'
            );
          },
        });
    } else {
      const payload: BidSubmissionCreateInput = {
        project_id: this.projectId(),
        customer_id: f.customer_id || this.project()?.customer_id || 0,
        customer_tender_id: f.customer_tender_id || undefined,
        tender_title: f.tender_title.trim(),
        tender_number: f.tender_number.trim(),
        submission_date: submissionDateStr,
        validity: validityStr,
        delivery_terms: f.delivery_terms || undefined,
        delivery_period: f.delivery_period || undefined,
        payment_terms: f.payment_terms || undefined,
        warranty_period: f.warranty_period || undefined,
        remark: f.remark?.trim() || undefined,
        items: this.items(),
      };

      this.bidSubmissionService
        .create(payload, this.attachments())
        .pipe(finalize(() => this.submitting.set(false)))
        .subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Bid Submitted',
              detail: 'Bid documents submitted successfully.',
            });
            this.closeDialog();
            this.loadSubmissions(this.projectId());
          },
          error: (err) => {
            this.errorMessage.set(
              err?.error?.message || 'Failed to create bid submission. Please check all fields.'
            );
          },
        });
    }
  }

  protected deleteSubmission(sub: BidSubmission): void {
    if (!confirm(`Are you sure you want to delete the bid submission for "${sub.tender_title}"?`)) {
      return;
    }

    this.bidSubmissionService.delete(sub.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Deleted',
          detail: 'Bid submission deleted successfully.',
        });
        this.loadSubmissions(this.projectId());
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete bid submission.',
        });
      },
    });
  }

  /* ── Validation Helpers ────────────────────────────────── */
  protected isFieldInvalid(fieldName: string): boolean {
    const ctrl = this.headerForm.get(fieldName);
    return !!ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  protected getFieldError(fieldName: string): string {
    const ctrl = this.headerForm.get(fieldName);
    if (!ctrl || !ctrl.errors) return '';
    if (ctrl.errors['required']) return 'This field is required.';
    if (ctrl.errors['minlength']) return 'Must be at least 2 characters.';
    return 'Invalid value.';
  }

  protected isRowFieldInvalid(fieldName: string): boolean {
    const ctrl = this.rowForm.get(fieldName);
    return !!ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  protected getRowFieldError(fieldName: string): string {
    const ctrl = this.rowForm.get(fieldName);
    if (!ctrl || !ctrl.errors) return '';
    if (ctrl.errors['required']) {
      if (fieldName === 'material_name') return 'Description is required';
      if (fieldName === 'quantity') return 'Quantity is required';
      return 'Required';
    }
    if (ctrl.errors['pattern'] || ctrl.errors['min']) {
      if (fieldName === 'quantity') return 'Enter a valid quantity';
      if (fieldName === 'unit_price') return 'Enter a valid price';
      return 'Invalid number';
    }
    return 'Invalid value';
  }

  protected calculateItemNet(item: BidSubmissionItem): number {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    return qty * price;
  }

  protected calculateSubmissionTotal(sub: BidSubmission): number {
    return (sub.items || []).reduce((acc, it) => acc + (this.calculateItemNet(it) || 0), 0);
  }

  protected parseValidityHelper(raw?: string | null): { value: string; unit: string } {
    return parseValidity(raw, '90', 'Days');
  }

  protected goBack(): void {
    this.router.navigate(['/projects', this.projectId(), 'timeline']);
  }
}
