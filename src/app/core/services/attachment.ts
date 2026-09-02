import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Attachment } from '../models/attachment.model';
import { API_BASE_URL } from '../tokens/api-base-url.token';

@Injectable({
  providedIn: 'root',
})
export class AttachmentService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getDownloadUrl(attachmentId: number): string {
    return `${this.apiBaseUrl}/api/v1/attachments/${attachmentId}/download`;
  }

  downloadAttachment(attachmentId: number): Observable<Blob> {
    return this.http.get(this.getDownloadUrl(attachmentId), {
      responseType: 'blob',
    });
  }

  downloadFile(attachment: Attachment): Observable<Blob> {
    return this.downloadAttachment(attachment.id);
  }
}
