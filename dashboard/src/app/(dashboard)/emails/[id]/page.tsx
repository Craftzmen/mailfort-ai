"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  FileCode,
  FileDown,
  FileText,
  Fingerprint,
  Globe,
  Hash,
  Link as LinkIcon,
  Mail,
  Paperclip,
  RefreshCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  User,
} from "lucide-react";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { emailsService, BlockchainStatus, EmailDetail, ForensicReport } from "@/services/api";
import { cn } from "@/lib/utils";

type UrlTelemetryItem = {
  url?: string;
  openphish?: { is_phishing?: boolean };
  virustotal?: {
    malicious?: number;
    suspicious?: number;
    stats?: { malicious?: number; suspicious?: number };
    data?: { attributes?: { last_analysis_stats?: { malicious?: number; suspicious?: number } } };
  };
};

type AttachmentTelemetryItem = {
  name?: string;
  filename?: string;
  hash?: string;
  is_suspicious?: boolean;
  vt_result?: {
    malicious?: number;
    suspicious?: number;
    stats?: { malicious?: number; suspicious?: number };
    data?: { attributes?: { last_analysis_stats?: { malicious?: number; suspicious?: number } } };
  };
};

type IpTelemetryItem = {
  ip?: string;
  abuseipdb?: { abuse_score?: number; country?: string; isp?: string };
};

type PdfReportInput = {
  emailId: number;
  sender: string;
  subject: string;
  verdict: string;
  createdAt: string;
  analysisConfidence: number;
  report: ForensicReport;
  blockchainTxId?: string | null;
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractThreatIntelHits(payload: unknown, type: "malicious" | "suspicious"): number {
  if (!payload || typeof payload !== "object") {
    return 0;
  }

  const typedPayload = payload as {
    malicious?: unknown;
    suspicious?: unknown;
    stats?: { malicious?: unknown; suspicious?: unknown };
    data?: { attributes?: { last_analysis_stats?: { malicious?: unknown; suspicious?: unknown } } };
  };

  if (type === "malicious") {
    return (
      toNumber(typedPayload.malicious) ||
      toNumber(typedPayload.stats?.malicious) ||
      toNumber(typedPayload.data?.attributes?.last_analysis_stats?.malicious)
    );
  }

  return (
    toNumber(typedPayload.suspicious) ||
    toNumber(typedPayload.stats?.suspicious) ||
    toNumber(typedPayload.data?.attributes?.last_analysis_stats?.suspicious)
  );
}

function severityStyle(severity?: string): string {
  switch ((severity || "info").toLowerCase()) {
    case "critical":
      return "border-rose-500/40 bg-rose-500/5";
    case "high":
      return "border-rose-500/25 bg-rose-500/5";
    case "medium":
      return "border-amber-500/30 bg-amber-500/5";
    case "low":
      return "border-sky-500/30 bg-sky-500/5";
    default:
      return "border-emerald-500/30 bg-emerald-500/5";
  }
}

function formatSafeDateTime(value?: string): string {
  if (!value) {
    return "N/A";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return format(parsed, "yyyy-MM-dd HH:mm:ss");
}

function formatBlockchainReason(reason?: string): string {
  if (!reason) {
    return "UNKNOWN";
  }

  return reason.replace(/_/g, " ").toUpperCase();
}

function getBlockchainReasonMessage(reason?: string, autoDeployEnabled?: boolean): string {
  switch (reason) {
    case "ready":
      return "Evidence was successfully recorded on-chain.";
    case "rpc_unreachable":
      return "Blockchain RPC is unreachable. Ensure Ganache/Hardhat is running and BLOCKCHAIN_RPC_URL is correct.";
    case "no_account":
      return "Blockchain RPC is reachable, but no unlocked account is available for transactions.";
    case "contract_not_configured":
      return autoDeployEnabled
        ? "Contract is not available yet. Auto-deploy is enabled, but deployment has not succeeded."
        : "No smart contract is configured. Set BLOCKCHAIN_CONTRACT_ADDRESS or deploy one via /api/blockchain/deploy.";
    case "deploy_failed":
      return "Contract deployment failed. Check backend logs for Solidity compile/deploy errors.";
    case "record_failed":
      return "Contract is available, but transaction submission failed while recording evidence.";
    case "contract_source_missing":
      return "Contract source file was not found. Ensure contracts/EvidenceRegistry.sol exists in backend project.";
    case "legacy_record":
      return "This report predates blockchain telemetry fields and may not include full status details.";
    case "not_available":
      return "No blockchain status was recorded for this report.";
    default:
      return "Blockchain status is currently unavailable.";
  }
}

function triggerFileDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function truncateForPdf(value: unknown, maxLen: number = 240): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLen) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLen - 3))}...`;
}

function summarizeEvidence(evidence: Record<string, unknown> | undefined): string {
  if (!evidence || Object.keys(evidence).length === 0) {
    return "No evidence payload attached.";
  }
  const pairs = Object.entries(evidence).slice(0, 4).map(([k, v]) => `${k}: ${truncateForPdf(v, 70)}`);
  return pairs.join(" | ");
}

async function generateAndDownloadForensicPdf(input: PdfReportInput): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 42;

  doc.setFillColor(10, 25, 47);
  doc.rect(0, 0, pageWidth, 116, "F");
  doc.setFillColor(30, 64, 175);
  doc.rect(0, 106, pageWidth, 10, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("MailFort AI - Forensic Threat Report", marginX, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Generated: ${formatSafeDateTime(input.report.generated_at || input.createdAt)}`, marginX, 72);
  doc.text(`Report ID: ${input.report.report_id || `EMAIL-${String(input.emailId).padStart(6, "0")}`}`, marginX, 88);

  doc.setTextColor(17, 24, 39);
  let cursorY = 142;

  const addSectionTitle = (title: string): void => {
    if (cursorY > pageHeight - 72) {
      doc.addPage();
      cursorY = 56;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(title, marginX, cursorY);
    cursorY += 10;
  };

  addSectionTitle("Executive Summary");
  doc.setDrawColor(59, 130, 246);
  doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
  cursorY += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  const summary = input.report.summary || "No automated summary available.";
  const wrappedSummary = doc.splitTextToSize(summary, pageWidth - marginX * 2);
  doc.text(wrappedSummary, marginX, cursorY);
  cursorY += wrappedSummary.length * 14 + 12;

  addSectionTitle("Case Metadata");
  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    head: [["Field", "Value"]],
    body: [
      ["Email ID", String(input.emailId)],
      ["Sender", truncateForPdf(input.sender, 140)],
      ["Subject", truncateForPdf(input.subject, 140)],
      ["Verdict", input.verdict],
      ["Severity", input.report.severity || "N/A"],
      ["Threat Score", `${toNumber(input.report.risk_score).toFixed(1)}%`],
      ["Analysis Confidence", `${Math.max(0, Math.min(100, input.analysisConfidence)).toFixed(1)}%`],
      ["Created At", formatSafeDateTime(input.createdAt)],
    ],
    styles: { fontSize: 9.5, cellPadding: 6, textColor: [17, 24, 39] },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    theme: "striped",
  });
  cursorY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
    ? (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18
    : cursorY + 18;

  addSectionTitle("Risk Factors and Recommendations");
  const riskFactors = (input.report.risk_factors || []).slice(0, 10);
  const recommendations = (input.report.recommendations || []).slice(0, 10);
  const maxRows = Math.max(riskFactors.length, recommendations.length, 1);
  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    head: [["Risk Factors", "Recommendations"]],
    body: Array.from({ length: maxRows }).map((_, idx) => [
      riskFactors[idx] ? `- ${truncateForPdf(riskFactors[idx], 120)}` : "-",
      recommendations[idx] ? `- ${truncateForPdf(recommendations[idx], 120)}` : "-",
    ]),
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
    theme: "grid",
  });
  cursorY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
    ? (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18
    : cursorY + 18;

  addSectionTitle("Indicators Snapshot");
  const indicators = input.report.indicators || {};
  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    head: [["Indicator Type", "Count", "Preview"]],
    body: [
      [
        "Suspicious URLs",
        String((indicators.suspicious_urls || []).length),
        truncateForPdf((indicators.suspicious_urls || []).slice(0, 3).join(" | ") || "None", 120),
      ],
      [
        "Suspicious Attachments",
        String((indicators.suspicious_attachments || []).length),
        truncateForPdf((indicators.suspicious_attachments || []).slice(0, 3).join(" | ") || "None", 120),
      ],
      [
        "Header Anomalies",
        String((indicators.header_anomalies || []).length),
        truncateForPdf((indicators.header_anomalies || []).slice(0, 3).join(" | ") || "None", 120),
      ],
    ],
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: "bold" },
    theme: "striped",
  });
  cursorY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
    ? (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18
    : cursorY + 18;

  addSectionTitle("Module Scores");
  const moduleScores = input.report.module_scores || {};
  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    head: [["Module", "Score"]],
    body: [
      ["NLP", `${toNumber(moduleScores.nlp).toFixed(1)}%`],
      ["URL", `${toNumber(moduleScores.url).toFixed(1)}%`],
      ["Header", `${toNumber(moduleScores.header).toFixed(1)}%`],
      ["Attachment", `${toNumber(moduleScores.attachment).toFixed(1)}%`],
      ["Final", `${toNumber(moduleScores.final ?? input.report.risk_score).toFixed(1)}%`],
    ],
    styles: { fontSize: 9.5, cellPadding: 6 },
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: "bold" },
    theme: "grid",
  });
  cursorY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
    ? (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18
    : cursorY + 18;

  addSectionTitle("Key Findings");
  const findings = (input.report.findings || []).slice(0, 20);
  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    head: [["Module", "Severity", "Finding", "Recommendation", "Evidence"]],
    body: findings.length
      ? findings.map((finding) => [
          String(finding.module || "module").toUpperCase(),
          String(finding.severity || "info").toUpperCase(),
          truncateForPdf(finding.title || "Untitled finding", 90),
          truncateForPdf(finding.recommendation || "Continue monitoring.", 100),
          truncateForPdf(summarizeEvidence(finding.evidence), 150),
        ])
      : [["-", "-", "No high-confidence findings were recorded.", "-", "-"]],
    styles: { fontSize: 8.5, cellPadding: 5.5, valign: "top" },
    headStyles: { fillColor: [127, 29, 29], textColor: [255, 255, 255], fontStyle: "bold" },
    theme: "striped",
  });
  cursorY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
    ? (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18
    : cursorY + 18;

  addSectionTitle("Blockchain Integrity Status");
  const blockchainStatus = input.report.blockchain_status;
  const resolvedBlockchainTxId = input.blockchainTxId || input.report.blockchain_tx || "";
  const isBlockchainVerified = Boolean(resolvedBlockchainTxId || input.report.blockchain_verified);
  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    head: [["Attribute", "Value"]],
    body: [
      ["Blockchain Verified", isBlockchainVerified ? "Yes" : "No"],
      ["Transaction ID", truncateForPdf(resolvedBlockchainTxId || "N/A", 120)],
      ["RPC Connected", blockchainStatus?.connected ? "Yes" : "No"],
      ["Contract Ready", blockchainStatus?.contract_ready ? "Yes" : "No"],
      ["Contract Address", truncateForPdf(blockchainStatus?.contract_address || "N/A", 120)],
      ["Account", truncateForPdf(blockchainStatus?.account || "N/A", 120)],
      ["RPC URL", truncateForPdf(blockchainStatus?.rpc_url || "N/A", 120)],
      ["Reason", truncateForPdf(blockchainStatus?.reason || "not_available", 120)],
    ],
    styles: { fontSize: 9.5, cellPadding: 6 },
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: "bold" },
    theme: "grid",
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `MailFort AI Confidential - Page ${i} of ${pageCount}`,
      pageWidth - marginX,
      pageHeight - 16,
      { align: "right" }
    );
  }

  const reportId = input.report.report_id || `EMAIL-${String(input.emailId).padStart(6, "0")}`;
  doc.save(`mailfort-report-${reportId}.pdf`);
}

export default function EmailDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const idParam = params?.id;
  const emailId = Number(idParam);

  const [data, setData] = useState<EmailDetail | null>(null);
  const [report, setReport] = useState<ForensicReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReporting, setIsReporting] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportNotice, setReportNotice] = useState<string | null>(null);

  const loadGeneratedReport = useCallback(
    async (currentEmailId: number, fallbackReport: ForensicReport | null = null) => {
      setIsLoadingReport(true);
      setReportNotice(null);

      try {
        const payload = await emailsService.getEmailReport(currentEmailId);
        setReport(payload.report);
      } catch (error) {
        console.error("Failed to fetch generated report:", error);
        if (fallbackReport) {
          setReport(fallbackReport);
          setReportNotice("Showing stored report from analysis snapshot. Live report endpoint was unavailable.");
        } else {
          setReport(null);
          setReportNotice("No generated report was found for this email record yet.");
        }
      } finally {
        setIsLoadingReport(false);
      }
    },
    []
  );

  useEffect(() => {
    let isMounted = true;

    const fetchDetail = async () => {
      if (!idParam || Number.isNaN(emailId)) {
        setLoading(false);
        return;
      }

      try {
        const detail = await emailsService.getEmail(emailId);
        if (!isMounted) {
          return;
        }

        setData(detail);
        setReport(detail.forensic_report || null);
        await loadGeneratedReport(emailId, detail.forensic_report || null);
      } catch (error) {
        console.error("Failed to fetch email detail:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDetail();

    return () => {
      isMounted = false;
    };
  }, [emailId, idParam, loadGeneratedReport]);

  const handleReportIp = async () => {
    if (Number.isNaN(emailId) || isReporting) {
      return;
    }

    setIsReporting(true);
    try {
      const result = await emailsService.reportIp(emailId);
      alert(`Reported: ${result.message}`);
    } catch (error) {
      console.error("Reporting failed:", error);
      alert("Failed to report IPs. See console.");
    } finally {
      setIsReporting(false);
    }
  };

  const handleDownloadJsonReport = () => {
    if (!report) {
      alert("No generated report is available to download yet.");
      return;
    }

    const reportId = report.report_id || `EMAIL-${String(idParam || "unknown")}`;
    triggerFileDownload(
      `mailfort-report-${reportId}.json`,
      `${JSON.stringify(report, null, 2)}\n`,
      "application/json"
    );
  };

  const handleGenerateReport = async () => {
    if (Number.isNaN(emailId) || isGeneratingReport) {
      return;
    }

    setIsGeneratingReport(true);
    setReportNotice(null);
    try {
      const payload = await emailsService.getEmailReport(emailId);
      setReport(payload.report);

      const ai = (data?.analysis_result?.ai_analysis || {}) as { confidence?: number; score?: number };
      const confidenceSource =
        typeof ai.confidence === "number"
          ? ai.confidence * 100
          : typeof ai.score === "number"
            ? ai.score * 100
            : toNumber(payload.report?.module_scores?.nlp);

      await generateAndDownloadForensicPdf({
        emailId,
        sender: data?.sender || payload.sender,
        subject: data?.subject || payload.subject,
        verdict: data?.verdict || payload.verdict,
        createdAt: data?.created_at || payload.created_at,
        analysisConfidence: Math.max(0, Math.min(100, confidenceSource)),
        report: payload.report,
        blockchainTxId: data?.blockchain_tx_id || payload.report?.blockchain_tx || null,
      });

      setReportNotice("Forensic report generated and PDF downloaded successfully.");
    } catch (error) {
      console.error("Failed to generate forensic report:", error);
      setReportNotice("Failed to generate PDF report. Please try again.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleDownloadMarkdownReport = async () => {
    if (Number.isNaN(emailId)) {
      return;
    }

    try {
      const markdown = await emailsService.getEmailReportMarkdown(emailId);
      const reportId = report?.report_id || `EMAIL-${String(idParam || "unknown")}`;
      triggerFileDownload(`mailfort-report-${reportId}.md`, markdown, "text/markdown");
      return;
    } catch (error) {
      console.error("Failed to fetch markdown report:", error);
    }

    const fallbackMarkdown =
      report?.markdown_report ||
      "# MailFort AI Forensic Report\n\nNo markdown report is available for this email at the moment.\n";
    const reportId = report?.report_id || `EMAIL-${String(idParam || "unknown")}`;
    triggerFileDownload(`mailfort-report-${reportId}.md`, fallbackMarkdown, "text/markdown");
  };

  const getVerdictStyles = (verdict: string) => {
    switch (verdict) {
      case "Safe":
        return {
          border: "border-emerald-500/50",
          bg: "bg-emerald-500/10",
          text: "text-emerald-500",
          icon: ShieldCheck,
        };
      case "Suspicious":
        return {
          border: "border-amber-500/50",
          bg: "bg-amber-500/10",
          text: "text-amber-500",
          icon: ShieldQuestion,
        };
      case "Malicious":
        return {
          border: "border-rose-500/50",
          bg: "bg-rose-500/10",
          text: "text-rose-500",
          icon: ShieldAlert,
        };
      default:
        return {
          border: "border-slate-500/50",
          bg: "bg-slate-500/10",
          text: "text-slate-500",
          icon: Shield,
        };
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Activity className="w-12 h-12 text-primary animate-pulse" />
        <p className="text-slate-500 animate-pulse font-mono uppercase tracking-widest text-xs">
          Assembling Intel Reconstruction...
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center p-12">
        <h2 className="text-xl font-bold text-white">Analysis Node Not Found</h2>
        <Button onClick={() => router.push("/emails")} className="mt-4">
          Return to Logs
        </Button>
      </div>
    );
  }

  const verdict = data.verdict;
  const analysisResult = data.analysis_result || {};
  const aiAnalysis = analysisResult?.ai_analysis || {};
  const urlAnalysis = analysisResult?.url_analysis || { results: [] };
  const attachmentAnalysis = analysisResult?.attachment_analysis || { results: [], files: [] };
  const ipAnalysis = analysisResult?.ip_analysis || { results: [] };

  const confidenceSource =
    typeof aiAnalysis.confidence === "number"
      ? aiAnalysis.confidence * 100
      : typeof aiAnalysis.score === "number"
        ? aiAnalysis.score * 100
        : toNumber(report?.module_scores?.nlp);
  const analysisConfidence = Math.max(0, Math.min(100, confidenceSource));

  const reasoning: string[] = Array.isArray(aiAnalysis.reasoning)
    ? aiAnalysis.reasoning.filter((item: unknown): item is string => typeof item === "string")
    : [];

  const urlResults: UrlTelemetryItem[] = Array.isArray(urlAnalysis.results) ? urlAnalysis.results : [];

  const attachmentResults: AttachmentTelemetryItem[] = Array.isArray(attachmentAnalysis.results)
    ? attachmentAnalysis.results
    : Array.isArray(attachmentAnalysis.files)
      ? attachmentAnalysis.files
      : [];

  const ipResults: IpTelemetryItem[] = Array.isArray(ipAnalysis.results) ? ipAnalysis.results : [];

  const reportFindings = Array.isArray(report?.findings) ? report?.findings : [];
  const reportRiskFactors = Array.isArray(report?.risk_factors) ? report.risk_factors : [];
  const reportRecommendations = Array.isArray(report?.recommendations) ? report.recommendations : [];
  const reportModuleDetails = report?.forensic_details || {};
  const reportIndicators = report?.indicators || {};
  const blockchainStatus: BlockchainStatus | undefined = report?.blockchain_status;
  const blockchainTxId = data.blockchain_tx_id || report?.blockchain_tx || null;
  const blockchainReasonCode =
    blockchainStatus?.reason || (report?.blockchain_verified ? "ready" : "not_available");
  const blockchainReasonText = getBlockchainReasonMessage(
    blockchainReasonCode,
    blockchainStatus?.auto_deploy_enabled
  );

  const vStyles = getVerdictStyles(verdict);
  const VerdictIcon = vStyles.icon;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between no-print">
        <Button
          variant="ghost"
          onClick={() => router.push("/emails")}
          className="text-slate-400 hover:text-white group"
        >
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Log Repository
        </Button>
        <div className="flex flex-wrap gap-3 justify-end">
          <Button
            variant="default"
            size="sm"
            onClick={handleGenerateReport}
            disabled={isGeneratingReport || Number.isNaN(emailId)}
            className="no-print"
          >
            <FileText className="w-4 h-4 mr-2" />
            {isGeneratingReport ? "Generating..." : "Generate Report"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!Number.isNaN(emailId)) {
                void loadGeneratedReport(emailId, report);
              }
            }}
            disabled={isLoadingReport || Number.isNaN(emailId)}
            className="bg-white/5 border-white/10 no-print"
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            {isLoadingReport ? "Refreshing..." : "Refresh Generated Report"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadJsonReport}
            disabled={!report}
            className="bg-white/5 border-white/10 no-print"
          >
            <FileCode className="w-4 h-4 mr-2" />
            Download JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadMarkdownReport}
            disabled={!report}
            className="bg-white/5 border-white/10 no-print"
          >
            <FileDown className="w-4 h-4 mr-2" />
            Download Markdown
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className={cn("border-2 overflow-hidden", vStyles.border, vStyles.bg)}>
            <div className={cn("p-6 text-center space-y-4", vStyles.bg)}>
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-md">
                <VerdictIcon className={cn("w-10 h-10", vStyles.text)} />
              </div>
              <div>
                <h3 className={cn("text-3xl font-bold font-outfit uppercase tracking-tighter", vStyles.text)}>
                  {verdict}
                </h3>
                <p className="text-slate-400 text-xs font-mono mt-1">
                  THREAT-LEVEL-0{verdict === "Safe" ? 1 : verdict === "Suspicious" ? 5 : 9}
                </p>
              </div>
            </div>
            <div className="p-6 bg-slate-950/40 space-y-4 border-t border-white/10">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Analysis Confidence</span>
                <span className="text-white font-bold">{analysisConfidence.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                <div
                  className={cn("h-full transition-all duration-1000", vStyles.text.replace("text", "bg"))}
                  style={{ width: `${analysisConfidence}%` }}
                />
              </div>
              <div className="pt-2">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2">
                  Primary Indicators
                </p>
                <div className="flex flex-wrap gap-2">
                  {reasoning.length > 0 ? (
                    reasoning.slice(0, 3).map((reason, index) => (
                      <Badge
                        key={`${reason}-${index}`}
                        variant="outline"
                        className="text-[10px] bg-white/5 border-white/10 text-slate-300"
                      >
                        {reason}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 italic">No model reasoning labels were attached.</p>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card className="bg-white/5 border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-primary" />
                Technical Meta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-mono">Timestamp</span>
                <p className="text-sm text-slate-300 font-mono">
                  {format(new Date(data.created_at), "yyyy-MM-dd HH:mm:ss")}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-mono">Correlation ID</span>
                <p className="text-sm text-slate-300 font-mono">
                  MLF-{String(Number.isNaN(emailId) ? 0 : emailId).padStart(6, "0")}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-mono">Origin Source</span>
                <p className="text-sm text-slate-300 truncate">{data.sender}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <Card className="bg-white/5 border-white/5 overflow-hidden">
            <div className="p-1 bg-linear-to-r from-primary/20 via-blue-500/10 to-transparent" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                Message Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                    Sender Address
                  </span>
                  <div className="flex items-center gap-2">
                    <User className="w-3 h-3 text-slate-500" />
                    <span className="text-sm text-white font-medium">{data.sender}</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                    Object (Subject)
                  </span>
                  <div className="flex items-center gap-2">
                    <FileText className="w-3 h-3 text-slate-500" />
                    <span className="text-sm text-white font-medium">{data.subject}</span>
                  </div>
                </div>
              </div>
              <div className="p-6 rounded-xl bg-slate-950 border border-white/5">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-3 block">
                  Payload Body
                </span>
                <div className="text-sm text-slate-400 leading-relaxed max-h-75 overflow-y-auto pr-4 font-mono">
                  {data.body || "No textual body detected in payload."}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card id="forensic-report" className="bg-white/5 border-white/5 overflow-hidden border-l-4 border-l-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Generated Forensic Report
              </CardTitle>
              <CardDescription>
                Structured report generated after analysis with indicators, findings, and executive-ready export.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {reportNotice ? (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2 text-amber-400 text-xs">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{reportNotice}</span>
                </div>
              ) : null}

              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-sm text-slate-200 leading-relaxed italic">
                  &quot;{report?.summary || "No automated summary available."}&quot;
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-slate-900/50 border border-white/5 space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">Report ID</p>
                  <p className="text-xs text-slate-200 font-mono break-all">{report?.report_id || "N/A"}</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-900/50 border border-white/5 space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">Generated At</p>
                  <p className="text-xs text-slate-200 font-mono">{formatSafeDateTime(report?.generated_at)}</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-900/50 border border-white/5 space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">Severity</p>
                  <p className="text-xs text-slate-200 uppercase">{report?.severity || "N/A"}</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-900/50 border border-white/5 space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">Threat Score</p>
                  <p className="text-xs text-slate-200">{toNumber(report?.risk_score).toFixed(1)}%</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-[10px] text-slate-500 uppercase font-bold tracking-widest flex items-center gap-2">
                    <Activity className="w-3 h-3 text-rose-500" />
                    Risk Factors Detected
                  </h4>
                  <ul className="space-y-2">
                    {reportRiskFactors.length > 0 ? (
                      reportRiskFactors.map((factor, index) => (
                        <li key={`${factor}-${index}`} className="text-xs text-rose-400 flex items-start gap-2">
                          <span className="mt-1.5 w-1 h-1 rounded-full bg-rose-500 shrink-0" />
                          {factor}
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-slate-500 italic">
                        No critical risk flags were detected in behavior analysis.
                      </li>
                    )}
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] text-slate-500 uppercase font-bold tracking-widest flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3 text-sky-500" />
                    Recommendations
                  </h4>
                  <ul className="space-y-2">
                    {reportRecommendations.length > 0 ? (
                      reportRecommendations.map((recommendation, index) => (
                        <li key={`${recommendation}-${index}`} className="text-xs text-sky-300 flex items-start gap-2">
                          <span className="mt-1.5 w-1 h-1 rounded-full bg-sky-500 shrink-0" />
                          {recommendation}
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-slate-500 italic">
                        No additional actions were suggested for this report.
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-white/5 pt-4">
                <div className="space-y-2 p-3 rounded-lg bg-slate-900/50 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">Suspicious URLs</p>
                  {Array.isArray(reportIndicators.suspicious_urls) && reportIndicators.suspicious_urls.length > 0 ? (
                    reportIndicators.suspicious_urls.slice(0, 4).map((url, index) => (
                      <p key={`${url}-${index}`} className="text-[11px] text-slate-300 truncate" title={url}>
                        • {url}
                      </p>
                    ))
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">No URL indicators.</p>
                  )}
                </div>
                <div className="space-y-2 p-3 rounded-lg bg-slate-900/50 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">Suspicious Attachments</p>
                  {Array.isArray(reportIndicators.suspicious_attachments) &&
                  reportIndicators.suspicious_attachments.length > 0 ? (
                    reportIndicators.suspicious_attachments.slice(0, 4).map((filename, index) => (
                      <p key={`${filename}-${index}`} className="text-[11px] text-slate-300 truncate" title={filename}>
                        • {filename}
                      </p>
                    ))
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">No attachment indicators.</p>
                  )}
                </div>
                <div className="space-y-2 p-3 rounded-lg bg-slate-900/50 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">Header Anomalies</p>
                  {Array.isArray(reportIndicators.header_anomalies) && reportIndicators.header_anomalies.length > 0 ? (
                    reportIndicators.header_anomalies.slice(0, 4).map((headerIssue, index) => (
                      <p key={`${headerIssue}-${index}`} className="text-[11px] text-slate-300 truncate" title={headerIssue}>
                        • {headerIssue}
                      </p>
                    ))
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">No header anomalies.</p>
                  )}
                </div>
              </div>

              <div className="border-t border-white/5 pt-4">
                <h4 className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-3">
                  Module Insights
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(reportModuleDetails).map(([moduleKey, details]) => {
                    const safeDetails = Array.isArray(details) ? details : [];
                    return (
                      <div key={moduleKey} className="space-y-2">
                        <span className="text-[9px] text-slate-400 uppercase font-mono">{moduleKey} Module</span>
                        <div className="space-y-1">
                          {safeDetails.length > 0 ? (
                            safeDetails.slice(0, 2).map((item, index) => (
                              <p key={`${moduleKey}-${index}`} className="text-[10px] text-slate-300 leading-tight">
                                • {item}
                              </p>
                            ))
                          ) : (
                            <p className="text-[10px] text-slate-600 italic">No anomalies.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-white/5 pt-4 space-y-3">
                <h4 className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Key Findings</h4>
                {reportFindings.length > 0 ? (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {reportFindings.map((finding, index) => {
                      const evidenceEntries = Object.entries(finding.evidence || {});
                      return (
                        <div
                          key={`${finding.id || finding.title || "finding"}-${index}`}
                          className={cn("rounded-lg border p-3 space-y-2", severityStyle(finding.severity))}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs text-white font-semibold">{finding.title || "Untitled finding"}</p>
                            <Badge className="text-[10px] uppercase bg-white/5 border-white/10 text-slate-300">
                              {(finding.module || "module").toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-[11px] uppercase text-slate-400">Severity: {finding.severity || "info"}</p>
                          <div className="space-y-1">
                            {evidenceEntries.length > 0 ? (
                              evidenceEntries.slice(0, 4).map(([key, value], evidenceIndex) => (
                                <p
                                  key={`${String(key)}-${evidenceIndex}`}
                                  className="text-[11px] text-slate-300 wrap-break-word"
                                >
                                  <span className="text-slate-500">{key}:</span> {String(value)}
                                </p>
                              ))
                            ) : (
                              <p className="text-[11px] text-slate-500 italic">No evidence payload attached.</p>
                            )}
                          </div>
                          <p className="text-[11px] text-sky-300">Recommendation: {finding.recommendation || "Continue monitoring."}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No high-confidence findings were recorded.</p>
                )}
              </div>

              <div className="border-t border-white/5 pt-4">
                <h4 className="text-[10px] text-slate-500 uppercase font-bold tracking-widest flex items-center gap-2 mb-3">
                  <Hash className="w-3 h-3 text-sky-500" />
                  Blockchain Verification
                </h4>
                {report?.blockchain_verified && blockchainTxId ? (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-500 text-xs font-bold">
                      <ShieldCheck className="w-4 h-4" />
                      Forensic Integrity Verified
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono break-all">TxID: {blockchainTxId}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] text-slate-400 font-mono">
                      <p className="break-all">Contract: {blockchainStatus?.contract_address || "N/A"}</p>
                      <p className="break-all">RPC: {blockchainStatus?.rpc_url || "N/A"}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-slate-900/50 border border-white/5 space-y-3">
                    <p className="text-xs text-slate-300">{blockchainReasonText}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="text-[10px] uppercase bg-white/5 border-white/10 text-slate-300">
                        {formatBlockchainReason(blockchainReasonCode)}
                      </Badge>
                      <Badge
                        className={cn(
                          "text-[10px] uppercase border",
                          blockchainStatus?.connected
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                        )}
                      >
                        {blockchainStatus?.connected ? "RPC Connected" : "RPC Offline"}
                      </Badge>
                      <Badge
                        className={cn(
                          "text-[10px] uppercase border",
                          blockchainStatus?.contract_ready
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                        )}
                      >
                        {blockchainStatus?.contract_ready ? "Contract Ready" : "Contract Missing"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px] text-slate-500 font-mono">
                      <p className="break-all">RPC: {blockchainStatus?.rpc_url || "N/A"}</p>
                      <p className="break-all">Account: {blockchainStatus?.account || "N/A"}</p>
                      <p className="break-all">Contract: {blockchainStatus?.contract_address || "N/A"}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="bg-white/5 border-white/5">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Globe className="w-5 h-5 text-sky-500" />
                  URL Telemetry
                </CardTitle>
                <CardDescription>Targeted link reputation analysis.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {urlResults.length > 0 ? (
                  urlResults.map((urlItem, index) => {
                    const vtMalicious = extractThreatIntelHits(urlItem.virustotal, "malicious");
                    const vtSuspicious = extractThreatIntelHits(urlItem.virustotal, "suspicious");
                    const maliciousSignals = Boolean(urlItem?.openphish?.is_phishing) || vtMalicious > 0;
                    const suspiciousSignals = vtSuspicious > 0;
                    const urlVerdict = maliciousSignals
                      ? "Malicious"
                      : suspiciousSignals
                        ? "Suspicious"
                        : "Safe";

                    return (
                      <div
                        key={`${urlItem.url || "url"}-${index}`}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-900/40 border border-white/5"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <LinkIcon className="w-4 h-4 text-slate-500 shrink-0" />
                          <span className="text-xs text-slate-400 truncate max-w-37.5">{urlItem.url}</span>
                        </div>
                        <Badge
                          className={cn(
                            "text-[10px] px-2",
                            urlVerdict === "Malicious"
                              ? "bg-rose-500/20 text-rose-500"
                              : urlVerdict === "Suspicious"
                                ? "bg-amber-500/20 text-amber-500"
                                : "bg-emerald-500/20 text-emerald-500"
                          )}
                        >
                          {urlVerdict}
                        </Badge>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4 italic">No external URL vectors detected.</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/5">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Paperclip className="w-5 h-5 text-indigo-500" />
                  Attachment Heuristics
                </CardTitle>
                <CardDescription>File signature and sandbox results.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {attachmentResults.length > 0 ? (
                  attachmentResults.map((attachmentItem, index) => {
                    const maliciousSignals = extractThreatIntelHits(attachmentItem.vt_result, "malicious");
                    const suspiciousSignals = extractThreatIntelHits(attachmentItem.vt_result, "suspicious");
                    const attachmentVerdict =
                      maliciousSignals > 0
                        ? "Malicious"
                        : attachmentItem?.is_suspicious || suspiciousSignals > 0
                          ? "Suspicious"
                          : "Safe";

                    const filename = attachmentItem.filename || attachmentItem.name || "unknown-file";

                    return (
                      <div
                        key={`${filename}-${index}`}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-900/40 border border-white/5"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Hash className="w-4 h-4 text-slate-500 shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] text-white truncate max-w-37.5 font-bold">{filename}</span>
                            <span className="text-[9px] text-slate-500 truncate">
                              {(attachmentItem.hash || "no-hash").substring(0, 16)}...
                            </span>
                          </div>
                        </div>
                        <Badge
                          className={cn(
                            "text-[10px] px-2",
                            attachmentVerdict === "Malicious"
                              ? "bg-rose-500/20 text-rose-500"
                              : attachmentVerdict === "Suspicious"
                                ? "bg-amber-500/20 text-amber-500"
                                : "bg-emerald-500/20 text-emerald-500"
                          )}
                        >
                          {attachmentVerdict}
                        </Badge>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4 italic">No attachment vectors detected.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white/5 border-white/5">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Globe className="w-5 h-5 text-amber-500" />
                  IP Telemetry
                </CardTitle>
                <CardDescription>Network origin and reputation analysis.</CardDescription>
              </div>
              {verdict === "Malicious" && ipResults.length > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReportIp}
                  disabled={isReporting}
                  className="bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500 hover:text-white"
                >
                  <ShieldAlert className="w-4 h-4 mr-2" />
                  {isReporting ? "Reporting..." : "Report to AbuseIPDB"}
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ipResults.length > 0 ? (
                  ipResults.map((ipItem, index) => (
                    <div
                      key={`${ipItem.ip || "ip"}-${index}`}
                      className="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-mono text-white">{ipItem.ip}</span>
                        <Badge
                          className={cn(
                            "text-[10px]",
                            toNumber(ipItem.abuseipdb?.abuse_score) > 50
                              ? "bg-rose-500/20 text-rose-500"
                              : "bg-emerald-500/20 text-emerald-500"
                          )}
                        >
                          Abuse Score: {toNumber(ipItem.abuseipdb?.abuse_score)}%
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="flex flex-col">
                          <span className="text-slate-500 uppercase font-bold">Country</span>
                          <span className="text-slate-300">{ipItem.abuseipdb?.country || "Unknown"}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-slate-500 uppercase font-bold">ISP</span>
                          <span className="text-slate-300 truncate" title={ipItem.abuseipdb?.isp}>
                            {ipItem.abuseipdb?.isp || "Unknown"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="col-span-2 text-xs text-slate-500 text-center py-4 italic">
                    No external IP origin data available.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .bg-slate-950, .bg-slate-900, .bg-white\\/5 { background: white !important; color: black !important; }
          .text-white, .text-slate-400, .text-slate-200 { color: black !important; }
          .border-white\\/5, .border-white\\/10 { border-color: #e2e8f0 !important; }
          .max-w-7xl { max-width: 100% !important; margin: 0 !important; padding: 20px !important; }
        }
      `}</style>
    </div>
  );
}
