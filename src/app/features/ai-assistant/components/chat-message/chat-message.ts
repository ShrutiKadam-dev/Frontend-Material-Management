import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import { ChatMessage } from '../../models/ai-assistant.models';
import { QueryResult } from '../query-result/query-result';

@Component({
  selector: 'app-ai-chat-message',
  imports: [DatePipe, ButtonModule, TooltipModule, QueryResult],
  templateUrl: './chat-message.html',
  styleUrl: './chat-message.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatMessageComponent {
  readonly message = input.required<ChatMessage>();
  readonly sqlToggled = output<string>();

  readonly copied = signal<boolean>(false);

  onToggleSql(): void {
    this.sqlToggled.emit(this.message().id);
  }

  async copySql(): Promise<void> {
    const sql = this.message().queryResult?.sql;
    if (!sql) {
      return;
    }

    try {
      await navigator.clipboard.writeText(sql);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
    }
  }
}
