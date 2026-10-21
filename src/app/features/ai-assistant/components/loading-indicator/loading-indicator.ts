import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-ai-loading-indicator',
  templateUrl: './loading-indicator.html',
  styleUrl: './loading-indicator.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingIndicator {}
