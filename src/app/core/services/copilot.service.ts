import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import type {
  CopilotAction,
  CopilotChatRequest,
  CopilotChatResponse,
  CopilotContext,
  CopilotMessage,
  CopilotRuntimeDiagnosis,
} from '../models/copilot.model';
import { API_BASE_URL } from '../tokens/api-base-url.token';

const STEP_NAMES: Record<number, string> = {
  1: 'Customer Query',
  2: 'Request Quotation',
  3: 'Supplier Quotation',
  4: 'Cost Sheet',
  5: 'Customer Quotation',
  6: 'Tender',
  7: 'Bid Documents',
  8: 'Purchase Order',
  9: 'Order Confirmation',
  10: 'Supplier Invoice',
  11: 'Import Logistics',
  12: 'Customs Clearance',
  13: 'Customer Delivery',
  14: 'Customer Payment',
  15: 'Supplier Payment',
};

const INITIAL_WELCOME_MESSAGE: CopilotMessage = {
  id: 'msg-welcome',
  sender: 'assistant',
  text: `👋 **Hello! I'm your Material Management Copilot.**\n\nI can assist you with supplier lookups, comparing quotations, tracking purchase orders, auditing invoices, and guiding you through each stage of the 15-step procurement workflow.`,
  timestamp: new Date().toISOString(),
  actions: [
    {
      label: 'View Dashboard',
      icon: 'pi pi-th-large',
      route: '/dashboard',
      actionType: 'navigate',
    },
    {
      label: 'Browse Suppliers',
      icon: 'pi pi-truck',
      route: '/suppliers',
      actionType: 'navigate',
    },
  ],
};

@Injectable({
  providedIn: 'root',
})
export class CopilotService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  readonly isOpen = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);
  readonly isDiagnosing = signal<boolean>(false);
  readonly runtimeDiagnosis = signal<CopilotRuntimeDiagnosis | null>(null);
  readonly messages = signal<CopilotMessage[]>([INITIAL_WELCOME_MESSAGE]);
  readonly context = signal<CopilotContext>({ currentRoute: '/dashboard' });

  readonly suggestedPrompts = computed(() => {
    const ctx = this.context();
    const route = ctx.currentRoute;
    const stepId = ctx.stepId;

    if (stepId) {
      const stepName = ctx.stepName || `Step ${stepId}`;
      switch (stepId) {
        case 1:
        case 2:
          return [
            `How do I convert this query into an RFQ?`,
            `Suggest qualified suppliers for these materials`,
            `What fields are required to proceed to Step 3?`,
          ];
        case 3:
          return [
            `How to compare multiple supplier quotes?`,
            `Check for price and delivery lead-time variances`,
            `Guide me to prepare the cost sheet for Step 4`,
          ];
        case 4:
        case 5:
          return [
            `How is the margin calculated in the Cost Sheet?`,
            `Generate customer quotation breakdown`,
            `Verify taxes, shipping, and customs charges`,
          ];
        case 8:
        case 9:
          return [
            `What items are included in Purchase Order?`,
            `Verify PO delivery date vs confirmation`,
            `Generate checklist before issuing PO to supplier`,
          ];
        case 10:
        case 15:
          return [
            `Perform 3-way match: PO vs Delivery vs Invoice`,
            `Check outstanding balances for this supplier`,
            `Audit tax breakdown on invoice`,
          ];
        case 11:
        case 12:
          return [
            `Check customs clearance document checklist`,
            `What is the Bill of Entry requirement?`,
            `Track import shipment status and container`,
          ];
        case 13:
        case 14:
          return [
            `Verify delivery Challan and customer receipt`,
            `Check customer payment milestones`,
            `Is this project ready for closure?`,
          ];
        default:
          return [
            `Explain what needs to be completed in ${stepName}`,
            `Check prerequisites for the next step`,
            `Show remarks or history for this step`,
          ];
      }
    }

    if (route.includes('/suppliers')) {
      return [
        `How do I add multiple POCs to a supplier?`,
        `Find suppliers with contact information in Mumbai`,
        `What are the best practices for supplier evaluation?`,
      ];
    }

    if (route.includes('/customers')) {
      return [
        `Show recent customer queries needing attention`,
        `Which customers have active tenders?`,
        `Customer profile validation checklist`,
      ];
    }

    if (route.includes('/projects')) {
      return [
        `Summarize active projects and current step bottlenecks`,
        `Which projects are waiting for supplier quotations?`,
        `How to create a new project lifecycle`,
      ];
    }

    return [
      `Summarize active projects and pending tasks`,
      `Which suppliers have pending quotes?`,
      `How does the 15-step procurement workflow work?`,
    ];
  });

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.updateContextFromUrl(event.urlAfterRedirects || event.url);
      });

    // Initialize with current URL
    this.updateContextFromUrl(this.router.url);
    this.fetchRuntimeDiagnosis();
  }

  toggle(): void {
    if (!this.isOpen()) {
      this.open();
    } else {
      this.close();
    }
  }

  open(): void {
    this.isOpen.set(true);
    if (!this.runtimeDiagnosis()) {
      this.fetchRuntimeDiagnosis();
    }
  }

  close(): void {
    this.isOpen.set(false);
  }

  clearChat(): void {
    this.messages.set([INITIAL_WELCOME_MESSAGE]);
  }

  fetchRuntimeDiagnosis(): void {
    this.isDiagnosing.set(true);
    this.http
      .get<CopilotRuntimeDiagnosis>(`${this.apiBaseUrl}/api/v1/copilot/diagnosis`)
      .subscribe({
        next: (diag) => {
          this.isDiagnosing.set(false);
          this.runtimeDiagnosis.set(diag);
        },
        error: () => {
          this.isDiagnosing.set(false);
          this.runtimeDiagnosis.set({
            ollamaConnected: false,
            ollamaUrl: 'http://localhost:11434',
            availableModels: [],
            activeModel: null,
            preferredModel: 'llama3.2',
            geminiConfigured: false,
            activeProvider: 'rule_based',
            statusMessage: 'Diagnosis endpoint unreachable. Using local procurement rules.',
            checkedAt: new Date().toISOString(),
          });
        },
      });
  }

  sendMessage(rawPrompt: string): void {
    const prompt = rawPrompt.trim();
    if (!prompt || this.isLoading()) {
      return;
    }

    const userMessage: CopilotMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: prompt,
      timestamp: new Date().toISOString(),
    };

    this.messages.update((msgs) => [...msgs, userMessage]);
    this.isLoading.set(true);

    const payload: CopilotChatRequest = {
      message: prompt,
      context: this.context(),
      conversationHistory: this.messages()
        .slice(-6)
        .map((m) => ({
          role: m.sender === 'user' ? 'user' : 'model',
          parts: m.text,
        })),
    };

    this.http
      .post<CopilotChatResponse>(`${this.apiBaseUrl}/api/v1/copilot/chat`, payload)
      .subscribe({
        next: (response) => {
          this.isLoading.set(false);
          if (response.diagnosis) {
            this.runtimeDiagnosis.set(response.diagnosis);
          }
          const assistantMessage: CopilotMessage = {
            id: `bot-${Date.now()}`,
            sender: 'assistant',
            text: response.reply,
            timestamp: new Date().toISOString(),
            actions: response.actions,
            provider: response.provider,
            model: response.model,
          };
          this.messages.update((msgs) => [...msgs, assistantMessage]);
        },
        error: () => {
          // Fallback to intelligent local procurement assistant simulation
          this.isLoading.set(false);
          const simulatedResponse = this.generateSimulatedReply(prompt, this.context());
          this.messages.update((msgs) => [...msgs, simulatedResponse]);
        },
      });
  }

  executeAction(action: CopilotAction): void {
    if (action.route) {
      void this.router.navigate([action.route], {
        queryParams: action.queryParams,
      });
    } else if (action.actionType === 'query' && action.payload) {
      this.sendMessage(action.payload);
    }
  }

  private updateContextFromUrl(url: string): void {
    const cleanUrl = url.split('?')[0] ?? '';
    const stepMatch = /\/projects\/(\d+)\/steps\/(\d+)/.exec(cleanUrl);

    if (stepMatch && stepMatch[1] && stepMatch[2]) {
      const projectId = parseInt(stepMatch[1], 10);
      const stepId = parseInt(stepMatch[2], 10);
      this.context.set({
        currentRoute: cleanUrl,
        projectId,
        stepId,
        stepName: STEP_NAMES[stepId] ?? `Step ${stepId}`,
      });
      return;
    }

    const projectOnlyMatch = /\/projects\/(\d+)/.exec(cleanUrl);
    if (projectOnlyMatch && projectOnlyMatch[1]) {
      this.context.set({
        currentRoute: cleanUrl,
        projectId: parseInt(projectOnlyMatch[1], 10),
      });
      return;
    }

    this.context.set({
      currentRoute: cleanUrl,
      projectId: null,
      stepId: null,
      stepName: null,
    });
  }

  private generateSimulatedReply(query: string, context: CopilotContext): CopilotMessage {
    const lower = query.toLowerCase();
    let reply = '';
    const actions: CopilotAction[] = [];

    if (lower.includes('supplier') || lower.includes('vendor')) {
      reply = `### 🏢 Supplier Procurement Intelligence\n\n` +
        `Suppliers can be configured with multiple Points of Contact (POCs), geographical addresses, and tax identifiers.\n\n` +
        `**Key Tips for Supplier Management:**\n` +
        `- Keep active phone numbers and emails for each assigned POC.\n` +
        `- In **Step 2 (Request Quotation)**, you can select and dispatch RFQs to multiple suppliers simultaneously.\n` +
        `- In **Step 3 (Supplier Quotation)**, log quoted rates, lead times, and validity dates for accurate cost sheet compilation.`;

      actions.push({
        label: 'Open Suppliers List',
        icon: 'pi pi-truck',
        route: '/suppliers',
        actionType: 'navigate',
      });
    } else if (lower.includes('step') || lower.includes('workflow') || lower.includes('lifecycle')) {
      reply = `### 🔄 15-Step Material Lifecycle Overview\n\n` +
        `1. **Customer Query** ➔ 2. **RFQ** ➔ 3. **Supplier Quotation**\n` +
        `4. **Cost Sheet** ➔ 5. **Customer Quotation** ➔ 6. **Tender**\n` +
        `7. **Bid Documents** ➔ 8. **Purchase Order** ➔ 9. **Order Confirmation**\n` +
        `10. **Supplier Invoice** ➔ 11. **Import Logistics** ➔ 12. **Customs Clearance**\n` +
        `13. **Customer Delivery** ➔ 14. **Customer Payment** ➔ 15. **Supplier Payment**\n\n` +
        `Each step requires mandatory verification before advancing to ensure audit compliance.`;

      if (context.projectId) {
        actions.push({
          label: `Project ${context.projectId} Timeline`,
          icon: 'pi pi-calendar',
          route: `/projects/${context.projectId}/steps`,
          actionType: 'navigate',
        });
      } else {
        actions.push({
          label: 'View Projects',
          icon: 'pi pi-briefcase',
          route: '/projects',
          actionType: 'navigate',
        });
      }
    } else if (lower.includes('po') || lower.includes('purchase order') || lower.includes('order')) {
      reply = `### 📋 Purchase Order Verification\n\n` +
        `When issuing a **Purchase Order (Step 8)**:\n` +
        `- Verify that quantities, unit rates, and Incoterms match the approved Cost Sheet (Step 4).\n` +
        `- Ensure payment milestone conditions align with cash flow requirements.\n` +
        `- Once issued, proceed to Step 9 for Order Confirmation tracking.`;

      actions.push({
        label: 'Projects',
        icon: 'pi pi-briefcase',
        route: '/projects',
        actionType: 'navigate',
      });
    } else if (lower.includes('custom') || lower.includes('logistics') || lower.includes('import')) {
      reply = `### 🚢 Logistics & Customs Clearance\n\n` +
        `For imported consignments:\n` +
        `- **Step 11 (Import Logistics)**: Tracks Bill of Lading, container numbers, and shipping line ETAs.\n` +
        `- **Step 12 (Customs Clearance)**: Requires Bill of Entry, duty payment receipts, and customs assessment approval.\n` +
        `- Clearance delays can be mitigated by uploading pre-shipment documents early.`;
    } else if (lower.includes('invoice') || lower.includes('payment') || lower.includes('match')) {
      reply = `### 💰 3-Way Matching & Payment Audit\n\n` +
        `Before approving payments:\n` +
        `- **Step 10**: Verify Supplier Invoice line items against Purchase Order (Step 8).\n` +
        `- **Step 13**: Confirm goods received note (GRN) / Delivery Challan.\n` +
        `- **Step 14 & 15**: Reconcile Customer Collections vs Supplier Disbursements to maintain margin protection.`;
    } else {
      reply = `I have analyzed your query regarding **"${query}"**.\n\n` +
        `Currently operating in **context: ${context.stepName || context.currentRoute}**.\n\n` +
        `> 💡 **Notice:** To connect live LLM intelligence (such as Google Gemini Flash), configure the \`/api/v1/copilot/chat\` route in your Flask backend. In the meantime, I am using the built-in procurement rule engine to assist you!`;

      actions.push({
        label: 'Go to Dashboard',
        icon: 'pi pi-th-large',
        route: '/dashboard',
        actionType: 'navigate',
      });
    }

    return {
      id: `bot-${Date.now()}`,
      sender: 'assistant',
      text: reply,
      timestamp: new Date().toISOString(),
      actions: actions.length > 0 ? actions : undefined,
    };
  }
}
