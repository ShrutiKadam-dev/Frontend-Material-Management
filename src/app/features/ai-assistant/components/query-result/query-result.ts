import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import { AiQueryResponse } from '../../models/ai-assistant.models';

@Component({
  selector: 'app-ai-query-result',
  imports: [FormsModule, ButtonModule, TooltipModule],
  templateUrl: './query-result.html',
  styleUrl: './query-result.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QueryResult {
  readonly result = input.required<AiQueryResponse>();
  readonly filterText = signal<string>('');

  readonly filteredRows = computed(() => {
    const rows = this.result().rows || [];
    const search = this.filterText().trim().toLowerCase();

    if (!search) {
      return rows;
    }

    return rows.filter((row) =>
      Object.values(row).some((val) =>
        String(val ?? '').toLowerCase().includes(search),
      ),
    );
  });

  formatHeader(col: string): string {
    return col
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  formatCell(val: unknown): string {
    if (val === null || val === undefined) {
      return '—';
    }
    if (typeof val === 'boolean') {
      return val ? 'Yes' : 'No';
    }
    return String(val);
  }

  exportCsv(): void {
    const res = this.result();
    const columns = res.columns || [];
    const rows = this.filteredRows();

    if (!columns.length || !rows.length) {
      return;
    }

    const headerLine = columns.map((col) => `"${col.replace(/"/g, '""')}"`).join(',');
    const rowLines = rows.map((row) =>
      columns
        .map((col) => {
          const raw = row[col];
          const val = raw === null || raw === undefined ? '' : String(raw);
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(','),
    );

    const csvContent = [headerLine, ...rowLines].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ai_query_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
