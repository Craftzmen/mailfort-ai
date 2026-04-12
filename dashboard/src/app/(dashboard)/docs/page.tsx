"use client";

import React, { useState } from "react";
import {
  FileText,
  ExternalLink,
  Code2,
  Shield,
  Globe,
  Paperclip,
  Activity,
  Server,
  Copy,
  Check,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface Endpoint {
  method: "GET" | "POST";
  path: string;
  description: string;
  badge: string;
  badgeColor: string;
}

const endpoints: Endpoint[] = [
  {
    method: "GET",
    path: "/health",
    description: "Check if the API server and ML engine are operational.",
    badge: "System",
    badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  },
  {
    method: "GET",
    path: "/api/stats",
    description:
      "Returns aggregate statistics — total analyzed, and breakdown by Safe/Suspicious/Malicious.",
    badge: "Analytics",
    badgeColor: "bg-sky-500/10 text-sky-500 border-sky-500/20",
  },
  {
    method: "GET",
    path: "/api/emails",
    description:
      'List email analysis logs. Query params: skip, limit, verdict ("Safe", "Suspicious", "Malicious").',
    badge: "Emails",
    badgeColor: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  },
  {
    method: "GET",
    path: "/api/emails/{id}",
    description:
      "Fetch full detail of a single email analysis including body, verdict, and all analysis data.",
    badge: "Emails",
    badgeColor: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  },
  {
    method: "GET",
    path: "/api/emails/{id}/report",
    description:
      "Retrieve the generated forensic report package for one analyzed email (risk factors, findings, recommendations, indicators).",
    badge: "Report",
    badgeColor: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  },
  {
    method: "GET",
    path: "/api/emails/{id}/report?format=markdown",
    description:
      "Export the same generated forensic report as Markdown for executive sharing and PDF conversion workflows.",
    badge: "Report",
    badgeColor: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  },
  {
    method: "POST",
    path: "/analyze/email",
    description:
      "Submit an email for analysis. Runs AI phishing detection, URL scanning, attachment analysis, and IP reputation checks. Returns a unified verdict.",
    badge: "Analysis",
    badgeColor: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  },
  {
    method: "POST",
    path: "/phase1/run",
    description:
      "Execute the dataset collection and preprocessing pipeline.",
    badge: "Pipeline",
    badgeColor: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  },
];

const curlExample = `curl -X POST "${API_BASE}/analyze/email" \\
  -H "Content-Type: application/json" \\
  -d '{
    "sender": "attacker@phishing-site.com",
    "subject": "Urgent: Reset your password!",
    "body": "Please click http://malicious-link.com to reset your password immediately.",
    "urls": ["http://malicious-link.com"]
  }'`;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-slate-500 hover:text-white"
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="w-4 h-4 text-emerald-500" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </Button>
  );
}

export default function DocsPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight text-white font-outfit">
            API Documentation
          </h2>
          <p className="text-slate-400">
            Reference for integrating with the MailFort AI backend services.
          </p>
        </div>
        <a
          href={`${API_BASE}/docs`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button
            variant="outline"
            size="sm"
            className="bg-white/5 border-white/10 text-slate-300 hover:text-white gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Open Swagger UI
          </Button>
        </a>
      </div>

      {/* Architecture Overview */}
      <Card className="bg-white/5 border-white/5 overflow-hidden">
        <div className="p-1 bg-linear-to-r from-primary/20 via-blue-500/10 to-transparent" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="w-5 h-5 text-primary" />
            System Architecture
          </CardTitle>
          <CardDescription>
            How the analysis pipeline processes email threats.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              {
                icon: Shield,
                title: "AI Detection",
                description:
                  "TF-IDF + Logistic Regression baseline with BERT transformer for phishing classification.",
                color: "text-primary",
              },
              {
                icon: Globe,
                title: "URL Analysis",
                description:
                  "OpenPhish feed matching and VirusTotal reputation scanning for all extracted URLs.",
                color: "text-sky-500",
              },
              {
                icon: Paperclip,
                title: "Attachment Scan",
                description:
                  "File type validation, SHA-256 hashing, and VirusTotal file reputation checks.",
                color: "text-indigo-500",
              },
              {
                icon: Activity,
                title: "IP Reputation",
                description:
                  "AbuseIPDB integration for sender infrastructure reputation analysis.",
                color: "text-amber-500",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-slate-900/50 border border-white/5 space-y-2"
              >
                <item.icon className={cn("w-6 h-6", item.color)} />
                <h4 className="text-sm font-bold text-white">{item.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Endpoint Reference */}
      <Card className="bg-white/5 border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Code2 className="w-5 h-5 text-primary" />
            Endpoint Reference
          </CardTitle>
          <CardDescription>
            All available REST API endpoints.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {endpoints.map((ep, i) => (
            <div
              key={i}
              className="flex flex-col md:flex-row md:items-center gap-3 p-4 rounded-xl bg-slate-900/40 border border-white/5 group hover:border-primary/20 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={cn(
                    "inline-flex items-center justify-center text-[10px] font-bold font-mono uppercase px-2.5 py-1 rounded-md min-w-12.5 text-center",
                    ep.method === "GET"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/20 text-amber-400"
                  )}
                >
                  {ep.method}
                </span>
                <code className="text-sm text-white font-mono">{ep.path}</code>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 leading-relaxed">
                  {ep.description}
                </p>
              </div>
              <Badge className={cn("text-[10px] shrink-0", ep.badgeColor)}>
                {ep.badge}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Usage Example */}
      <Card className="bg-white/5 border-white/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5 text-primary" />
                Quick Start — Analyze an Email
              </CardTitle>
              <CardDescription>
                Use curl to submit an email for analysis.
              </CardDescription>
            </div>
            <CopyButton text={curlExample} />
          </div>
        </CardHeader>
        <CardContent>
          <pre className="p-4 rounded-xl bg-slate-950 border border-white/5 overflow-x-auto text-xs text-slate-300 font-mono leading-relaxed">
            {curlExample}
          </pre>
        </CardContent>
      </Card>

      {/* Scoring Guide */}
      <Card className="bg-white/5 border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="w-5 h-5 text-primary" />
            Verdict Scoring Logic
          </CardTitle>
          <CardDescription>
            How the system determines the final threat verdict.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <h4 className="text-sm font-bold text-emerald-500">Safe</h4>
                </div>
                <p className="text-xs text-slate-400">
                  No indicators from any analysis vector. All scores below
                  thresholds.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <h4 className="text-sm font-bold text-amber-500">
                    Suspicious
                  </h4>
                </div>
                <p className="text-xs text-slate-400">
                  Moderate risk signals: suspicious file types, AI confidence
                  55-80%, or partial threat intel matches.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/10 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <h4 className="text-sm font-bold text-rose-500">Malicious</h4>
                </div>
                <p className="text-xs text-slate-400">
                  High-confidence threats: VirusTotal malicious hits, OpenPhish
                  matches, or AI score ≥ 80%.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
