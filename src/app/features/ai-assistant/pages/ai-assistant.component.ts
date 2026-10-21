import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';

import { ChatComponent } from '../components/chat/chat';
import { AiAssistantService } from '../services/ai-assistant.service';

@Component({
  selector: 'app-ai-assistant',
  imports: [ButtonModule, DialogModule, TooltipModule, ChatComponent],
  templateUrl: './ai-assistant.component.html',
  styleUrl: './ai-assistant.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiAssistantComponent implements OnInit {
  protected readonly aiService = inject(AiAssistantService);
  protected readonly schemaDialogVisible = signal<boolean>(false);
  protected readonly selectedTable = signal<string | null>(null);

  ngOnInit(): void {
    this.aiService.fetchSchema().subscribe();
  }

  toggleSchemaDialog(): void {
    this.schemaDialogVisible.update((v) => !v);
  }
}
