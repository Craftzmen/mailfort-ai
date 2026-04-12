import axios from 'axios';

// Default to local FastAPI URL if not set
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export interface EmailLog {
  id: number;
  sender: string;
  subject: string;
  verdict: string;
  created_at: string;
}

export interface EmailAnalysisResult {
  ai_analysis?: {
    label?: number;
    confidence?: number;
    score?: number;
    reasoning?: string[];
    [key: string]: unknown;
  };
  url_analysis?: {
    results?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
  attachment_analysis?: {
    results?: Array<Record<string, unknown>>;
    files?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
  ip_analysis?: {
    results?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
  final_score?: number;
  [key: string]: unknown;
}

export interface EmailDetail extends EmailLog {
  body: string;
  analysis_result: EmailAnalysisResult | null;
  blockchain_tx_id: string | null;
  evidence_hash: string | null;
  forensic_report: ForensicReport | null;
}

export interface ForensicFinding {
  id?: string;
  module?: string;
  severity?: string;
  title?: string;
  evidence?: Record<string, unknown>;
  recommendation?: string;
}

export interface ForensicIndicators {
  suspicious_urls?: string[];
  suspicious_attachments?: string[];
  header_anomalies?: string[];
}

export interface ForensicModuleScores {
  nlp?: number;
  url?: number;
  header?: number;
  attachment?: number;
  final?: number;
}

export interface ForensicReport {
  report_id?: string;
  report_version?: string;
  generated_at?: string;
  final_verdict?: string;
  severity?: string;
  risk_score?: number;
  summary?: string;
  risk_factors?: string[];
  module_scores?: ForensicModuleScores;
  findings?: ForensicFinding[];
  recommendations?: string[];
  indicators?: ForensicIndicators;
  forensic_details?: {
    nlp?: string[];
    url?: string[];
    header?: string[];
    attachment?: string[];
    [key: string]: string[] | undefined;
  };
  blockchain_verified?: boolean;
  blockchain_tx?: string | null;
  markdown_report?: string;
}

export interface EmailReportResponse {
  email_id: number;
  sender: string;
  subject: string;
  verdict: string;
  created_at: string;
  report: ForensicReport;
}

export interface ReportIpResponse {
  message: string;
  results?: Array<{
    ip: string;
    status: string;
    details?: unknown;
  }>;
}

export interface SearchEmailsResponse {
  items: EmailLog[];
  total: number;
  skip: number;
  limit: number;
}

export interface StatsBreakdown {
  Safe: number;
  Suspicious: number;
  Malicious: number;
}

export interface Stats {
  total: number;
  breakdown: StatsBreakdown;
}

export const emailsService = {
  getStats: async (): Promise<Stats> => {
    const response = await api.get('/stats');
    return response.data;
  },

  getEmails: async (skip: number = 0, limit: number = 50, verdict?: string): Promise<EmailLog[]> => {
    const response = await api.get('/emails', {
      params: { skip, limit, verdict }
    });
    return response.data;
  },

  getEmail: async (id: number): Promise<EmailDetail> => {
    const response = await api.get(`/emails/${id}`);
    return response.data;
  },

  getEmailReport: async (id: number): Promise<EmailReportResponse> => {
    const response = await api.get(`/emails/${id}/report`);
    return response.data;
  },

  getEmailReportMarkdown: async (id: number): Promise<string> => {
    const response = await api.get(`/emails/${id}/report`, {
      params: { format: "markdown" },
      responseType: "text",
      headers: { Accept: "text/markdown" },
    });
    return response.data as string;
  },

  searchEmails: async (
    query: string,
    limit: number = 25,
    skip: number = 0,
    verdict?: string,
  ): Promise<SearchEmailsResponse> => {
    const response = await api.get('/search', {
      params: { q: query, skip, limit, verdict }
    });
    return response.data;
  },

  reportIp: async (emailId: number): Promise<ReportIpResponse> => {
    const response = await api.post(`/emails/${emailId}/report`);
    return response.data;
  },

  clearAllEmails: async (): Promise<{ deleted: number }> => {
    const response = await api.delete('/emails');
    return response.data;
  },
};

// Health check (hits root, not /api)
const rootApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://127.0.0.1:8000',
});

export const systemService = {
  healthCheck: async (): Promise<{ status: string; service: string }> => {
    const response = await rootApi.get('/health');
    return response.data;
  },
};
