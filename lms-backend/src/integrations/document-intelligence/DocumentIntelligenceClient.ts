import crypto from "crypto";

export interface ProcessDocumentRequest {
  job_id: string;
  document_id: string;
  organization_id: string;
  owner_user_id: string;
  storage_bucket: string;
  storage_key: string;
  mime_type: string;
  file_size_bytes: number;
  processing_type: string;
}

export interface ProcessDocumentResponse {
  success: boolean;
  job_id: string;
  document_id: string;
  status: string;
  result?: any;
}

export class DocumentIntelligenceClient {
  private baseUrl: string;
  private serviceKey: string;
  private timeoutMs: number;

  constructor() {
    this.baseUrl = process.env.DOCUMENT_INTELLIGENCE_URL || "http://localhost:8000";
    this.serviceKey = process.env.DOCUMENT_INTELLIGENCE_SERVICE_KEY || "";
    this.timeoutMs = parseInt(process.env.DOCUMENT_INTELLIGENCE_TIMEOUT_MS || "60000", 10);
  }

  async processDocument(requestData: ProcessDocumentRequest): Promise<ProcessDocumentResponse> {
    const requestId = crypto.randomUUID();
    const url = `${this.baseUrl}/internal/jobs/process-document`;

    console.log(`[DocumentIntelligenceClient] Starting processing request ${requestId} for document ${requestData.document_id}, organization ${requestData.organization_id}, type ${requestData.processing_type}`);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, this.timeoutMs);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Service-Key": this.serviceKey,
          "X-Request-Id": requestId,
        },
        body: JSON.stringify(requestData),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        let errorBody;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = await response.text();
        }
        console.error(`[DocumentIntelligenceClient] Request ${requestId} failed with status ${response.status}:`, errorBody);
        throw new Error(`Document Intelligence Service returned ${response.status}`);
      }

      const responseData: ProcessDocumentResponse = await response.json();
      console.log(`[DocumentIntelligenceClient] Request ${requestId} accepted/completed with status ${responseData.status}`);
      
      return responseData;
    } catch (error: any) {
      console.error(`[DocumentIntelligenceClient] Request ${requestId} failed:`, error.message);
      throw error;
    }
  }
}
