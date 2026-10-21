import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import { SuggestedPrompt } from '../../models/ai-assistant.models';
import { AiAssistantService } from '../../services/ai-assistant.service';
import { ChatMessageComponent } from '../chat-message/chat-message';
import { LoadingIndicator } from '../loading-indicator/loading-indicator';

@Component({
  selector: 'app-ai-chat',
  imports: [
    FormsModule,
    ButtonModule,
    TooltipModule,
    ChatMessageComponent,
    LoadingIndicator,
  ],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatComponent implements AfterViewChecked {
  protected readonly aiService = inject(AiAssistantService);

  readonly messagesContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');
  readonly questionInput = signal<string>('');

  private shouldScrollBottom = false;

  ngAfterViewChecked(): void {
    if (this.shouldScrollBottom) {
      this.scrollToBottom();
      this.shouldScrollBottom = false;
    }
  }

  onToggleSql(messageId: string): void {
    this.aiService.toggleSqlView(messageId);
  }

  submitQuestion(): void {
    const text = this.questionInput().trim();
    if (!text || this.aiService.loading()) {
      return;
    }

    this.questionInput.set('');
    this.shouldScrollBottom = true;

    this.aiService.sendQuestion(text).subscribe({
      next: () => {
        this.shouldScrollBottom = true;
      },
      error: () => {
        this.shouldScrollBottom = true;
      },
    });
  }

  usePrompt(prompt: SuggestedPrompt): void {
    this.questionInput.set(prompt.query);
    this.submitQuestion();
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.submitQuestion();
    }
  }

  private scrollToBottom(): void {
    const el = this.messagesContainer()?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }
}
