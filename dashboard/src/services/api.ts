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

export interface EmailDetail extends EmailLog {
  body: string;
  analysis_result: any;
  blockchain_tx_id: string | null;
  evidence_hash: string | null;
  forensic_report: {
    summary: string;
    risk_factors: string[];
    forensic_details: {
      nlp: string[];
      url: string[];
      header: string[];
      attachment: string[];
    };
    blockchain_verified: boolean;
    blockchain_tx: string | null;
  } | null;
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
