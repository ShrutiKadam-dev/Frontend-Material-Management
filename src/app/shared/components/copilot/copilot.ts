import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';

import type { CopilotAction } from '../../../core/models/copilot.model';
import { CopilotService } from '../../../core/services/copilot.service';

@Component({
  selector: 'app-copilot',
  imports: [FormsModule, ButtonModule, InputTextModule, TooltipModule],
  templateUrl: './copilot.html',
  styleUrl: './copilot.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscapeKey()',
  },
})
export class CopilotComponent {
  protected readonly copilotService = inject(CopilotService);

  protected readonly isOpen = this.copilotService.isOpen;
  protected readonly isLoading = this.copilotService.isLoading;
  protected readonly messages = this.copilotService.messages;
  protected readonly context = this.copilotService.context;
  protected readonly suggestedPrompts = this.copilotService.suggestedPrompts;

  protected readonly inputPrompt = signal<string>('');
  protected readonly diagnosis = this.copilotService.runtimeDiagnosis;
  protected readonly isDiagnosing = this.copilotService.isDiagnosing;
  protected readonly showDiagnosisPanel = signal<boolean>(false);
  private readonly messagesContainer = viewChild<ElementRef<HTMLDivElement>>('messagesContainer');

  constructor() {
    effect(() => {
      const msgs = this.messages();
      if (msgs.length > 0) {
        setTimeout(() => this.scrollToBottom(), 60);
      }
    });
  }

  protected toggleOpen(): void {
    this.copilotService.toggle();
  }

  protected close(): void {
    this.copilotService.close();
  }

  protected clearChat(): void {
    this.copilotService.clearChat();
  }

  protected send(): void {
    const text = this.inputPrompt().trim();
    if (!text || this.isLoading()) {
      return;
    }
    this.copilotService.sendMessage(text);
    this.inputPrompt.set('');
  }

  protected selectSuggestion(prompt: string): void {
    this.copilotService.sendMessage(prompt);
  }

  protected onActionClick(action: CopilotAction): void {
    this.copilotService.executeAction(action);
  }

  protected toggleDiagnosisPanel(): void {
    this.showDiagnosisPanel.update((v) => !v);
  }

  protected refreshDiagnosis(): void {
    this.copilotService.fetchRuntimeDiagnosis();
  }

  protected onEscapeKey(): void {
    if (this.isOpen()) {
      this.close();
    }
  }

  protected formatMessage(text: string): string {
    if (!text) {
      return '';
    }

    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Horizontal Rule: ---
    escaped = escaped.replace(/^\s*---+\s*$/gim, '<hr class="msg-hr"/>');

    // Headers: #### Title, ### Title, ## Title
    escaped = escaped.replace(/^####\s+(.*$)/gim, '<h5 class="msg-heading-sm">$1</h5>');
    escaped = escaped.replace(/^###\s+(.*$)/gim, '<h4 class="msg-heading">$1</h4>');
    escaped = escaped.replace(/^##\s+(.*$)/gim, '<h3 class="msg-heading-lg">$1</h3>');

    // Inline code: `code`
    escaped = escaped.replace(/`([^`]+)`/g, '<code class="msg-code">$1</code>');

    // Bold: **text**
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Blockquote: > text
    escaped = escaped.replace(/^>\s+(.*$)/gim, '<blockquote class="msg-quote">$1</blockquote>');

    // Numbered list items: 1. Item
    escaped = escaped.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li class="msg-li-num" value="$1">$2</li>');

    // Bullet list items: - Item or * Item
    escaped = escaped.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="msg-li">$1</li>');

    // Wrap continuous li tags
    escaped = escaped.replace(/(<li class="msg-li">[\s\S]*?<\/li>(?!\s*<li class="msg-li">))/gi, '<ul class="msg-ul">$1</ul>');
    escaped = escaped.replace(/(<li class="msg-li-num"[^>]*>[\s\S]*?<\/li>(?!\s*<li class="msg-li-num"))/gi, '<ol class="msg-ol">$1</ol>');

    // Line breaks
    escaped = escaped.replace(/\n/g, '<br/>');

    return escaped;
  }

  private scrollToBottom(): void {
    const el = this.messagesContainer()?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }
}
