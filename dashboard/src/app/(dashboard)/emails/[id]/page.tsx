"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Download, 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  ShieldQuestion, 
  Globe, 
  Paperclip, 
  Mail, 
  Activity,
  User,
  Hash,
  Fingerprint,
  Link as LinkIcon,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { emailsService, EmailDetail } from "@/services/api";
import { cn } from "@/lib/utils";

type UrlTelemetryItem = {
  url?: string;
  openphish?: { is_phishing?: boolean };
  virustotal?: { malicious?: number; suspicious?: number };
};

type AttachmentTelemetryItem = {
  name?: string;
  hash?: string;
  is_suspicious?: boolean;
  vt_result?: { malicious?: number; suspicious?: number };
};

type IpTelemetryItem = {
  ip?: string;
  abuseipdb?: { abuse_score?: number; country?: string; isp?: string };
};

export default function EmailDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<EmailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReporting, setIsReporting] = useState(false);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!id) return;
      try {
        const detail = await emailsService.getEmail(Number(id));
        setData(detail);
      } catch (error) {
        console.error("Failed to fetch email detail:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Activity className="w-12 h-12 text-primary animate-pulse" />
        <p className="text-slate-500 animate-pulse font-mono uppercase tracking-widest text-xs">Assembling Intel Reconstruction...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center p-12">
        <h2 className="text-xl font-bold text-white">Analysis Node Not Found</h2>
        <Button onClick={() => router.push("/emails")} className="mt-4">Return to Logs</Button>
      </div>
    );
  }

  const { verdict, analysis_result } = data;
  const ai_analysis = analysis_result?.ai_analysis || {};
  const url_analysis = analysis_result?.url_analysis || { results: [] };
  const attachment_analysis = analysis_result?.attachment_analysis || { results: [] };
  const ip_analysis = analysis_result?.ip_analysis || { results: [] };

  const handleReportIp = async () => {
    if (!id || isReporting) return;
    setIsReporting(true);
    try {
      const result = await emailsService.reportIp(Number(id));
      alert(`Reported: ${result.message}`);
    } catch (error) {
      console.error("Reporting failed:", error);
      alert("Failed to report IPs. See console.");
    } finally {
      setIsReporting(false);
    }
  };

  const getVerdictStyles = (v: string) => {
    switch (v) {
      case "Safe": return { border: "border-emerald-500/50", bg: "bg-emerald-500/10", text: "text-emerald-500", icon: ShieldCheck };
      case "Suspicious": return { border: "border-amber-500/50", bg: "bg-amber-500/10", text: "text-amber-500", icon: ShieldQuestion };
      case "Malicious": return { border: "border-rose-500/50", bg: "bg-rose-500/10", text: "text-rose-500", icon: ShieldAlert };
      default: return { border: "border-slate-500/50", bg: "bg-slate-500/10", text: "text-slate-500", icon: Shield };
    }
  };

  const vStyles = getVerdictStyles(verdict);
  const VerdictIcon = vStyles.icon;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Actions */}
      <div className="flex items-center justify-between no-print">
        <Button variant="ghost" onClick={() => router.push("/emails")} className="text-slate-400 hover:text-white group">
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Log Repository
        </Button>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={handlePrint} className="bg-white/5 border-white/10 no-print">
            <Download className="w-4 h-4 mr-2" />
            Generate PDF Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Verdict and Core Info */}
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
                <p className="text-slate-400 text-xs font-mono mt-1">THREAT-LEVEL-0{verdict === "Safe" ? 1 : verdict === "Suspicious" ? 5 : 9}</p>
              </div>
            </div>
            <div className="p-6 bg-slate-950/40 space-y-4 border-t border-white/10">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Analysis Confidence</span>
                <span className="text-white font-bold">{(ai_analysis.score * 100 || 85).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full transition-all duration-1000", vStyles.text.replace("text", "bg"))} 
                  style={{ width: `${ai_analysis.score * 100 || 85}%` }} 
                />
              </div>
              <div className="pt-2">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2">Primary Indicators</p>
                <div className="flex flex-wrap gap-2">
                   {ai_analysis.reasoning?.slice(0, 3).map((reason: string, i: number) => (
                     <Badge key={i} variant="outline" className="text-[10px] bg-white/5 border-white/10 text-slate-300">
                       {reason}
                     </Badge>
                   ))}
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
                <p className="text-sm text-slate-300 font-mono">{format(new Date(data.created_at), "yyyy-MM-dd HH:mm:ss")}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-mono">Correlation ID</span>
                <p className="text-sm text-slate-300 font-mono">MLF-{id?.toString().padStart(6, '0')}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-mono">Origin Source</span>
                <p className="text-sm text-slate-300 truncate">{data.sender}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Detailed Breakdown */}
        <div className="lg:col-span-2 space-y-8">
          {/* Email Content */}
          <Card className="bg-white/5 border-white/5 overflow-hidden">
            <div className="p-1 bg-gradient-to-r from-primary/20 via-blue-500/10 to-transparent" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                Message Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Sender Address</span>
                  <div className="flex items-center gap-2">
                    <User className="w-3 h-3 text-slate-500" />
                    <span className="text-sm text-white font-medium">{data.sender}</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Object (Subject)</span>
                  <div className="flex items-center gap-2">
                    <FileText className="w-3 h-3 text-slate-500" />
                    <span className="text-sm text-white font-medium">{data.subject}</span>
                  </div>
                </div>
              </div>
              <div className="p-6 rounded-xl bg-slate-950 border border-white/5">
                 <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-3 block">Payload Body</span>
                 <div className="text-sm text-slate-400 leading-relaxed max-h-[300px] overflow-y-auto pr-4 font-mono">
                   {data.body || "No textual body detected in payload."}
                 </div>
              </div>
            </CardContent>
          </Card>

          {/* Forensic Intelligence Report */}
          <Card className="bg-white/5 border-white/5 overflow-hidden border-l-4 border-l-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Forensic Analysis Report
              </CardTitle>
              <CardDescription>Deep behavioral inspection results and social engineering detection.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-sm text-slate-200 leading-relaxed italic">
                  "{data.forensic_report?.summary || "No automated summary available."}"
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-[10px] text-slate-500 uppercase font-bold tracking-widest flex items-center gap-2">
                    <Activity className="w-3 h-3 text-rose-500" />
                    Risk Factors Detected
                  </h4>
                  <ul className="space-y-2">
                    {data.forensic_report?.risk_factors?.length > 0 ? (
                      data.forensic_report.risk_factors.map((factor, i) => (
                        <li key={i} className="text-xs text-rose-400 flex items-start gap-2">
                          <span className="mt-1.5 w-1 h-1 rounded-full bg-rose-500 flex-shrink-0" />
                          {factor}
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-slate-500 italic">No critical risk flags detected in behavior analysis.</li>
                    )}
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] text-slate-500 uppercase font-bold tracking-widest flex items-center gap-2">
                    <Hash className="w-3 h-3 text-sky-500" />
                    Blockchain Verification
                  </h4>
                  {data.forensic_report?.blockchain_verified ? (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-500 text-xs font-bold">
                        <ShieldCheck className="w-4 h-4" />
                        Forensic Integrity Verified
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono break-all">
                        TxID: {data.blockchain_tx_id}
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-slate-900/50 border border-white/5">
                      <p className="text-xs text-slate-500 italic">Not recorded on blockchain ledger.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-white/5 pt-4">
                <h4 className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-3">Module Insights</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(data.forensic_report?.forensic_details || {}).map(([key, details]) => (
                    <div key={key} className="space-y-2">
                      <span className="text-[9px] text-slate-400 uppercase font-mono">{key} Module</span>
                      <div className="space-y-1">
                        {details.length > 0 ? (
                          details.slice(0, 2).map((d, i) => (
                            <p key={i} className="text-[10px] text-slate-300 leading-tight">• {d}</p>
                          ))
                        ) : (
                          <p className="text-[10px] text-slate-600 italic">No anomalies.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
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
                {url_analysis.results?.length > 0 ? (
                  url_analysis.results.map((url: UrlTelemetryItem, i: number) => {
                    const maliciousSignals =
                      Boolean(url?.openphish?.is_phishing) ||
                      Number(url?.virustotal?.malicious || 0) > 0;
                    const suspiciousSignals = Number(url?.virustotal?.suspicious || 0) > 0;
                    const urlVerdict = maliciousSignals
                      ? "Malicious"
                      : suspiciousSignals
                        ? "Suspicious"
                        : "Safe";

                    return (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/40 border border-white/5">
                      <div className="flex items-center gap-3 min-w-0">
                        <LinkIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span className="text-xs text-slate-400 truncate max-w-[150px]">{url.url}</span>
                      </div>
                      <Badge className={cn(
                        "text-[10px] px-2",
                        urlVerdict === "Malicious"
                          ? "bg-rose-500/20 text-rose-500"
                          : urlVerdict === "Suspicious"
                            ? "bg-amber-500/20 text-amber-500"
                            : "bg-emerald-500/20 text-emerald-500"
                      )}>
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
                <CardDescription>File signature & sandbox results.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {attachment_analysis.results?.length > 0 ? (
                  attachment_analysis.results.map((att: AttachmentTelemetryItem, i: number) => {
                    const attachmentVerdict =
                      Number(att?.vt_result?.malicious || 0) > 0
                        ? "Malicious"
                        : att?.is_suspicious || Number(att?.vt_result?.suspicious || 0) > 0
                          ? "Suspicious"
                          : "Safe";

                    return (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/40 border border-white/5">
                      <div className="flex items-center gap-3 min-w-0">
                        <Hash className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <div className="flex flex-col min-w-0">
                           <span className="text-[10px] text-white truncate max-w-[150px] font-bold">{att.name || "unknown-file"}</span>
                           <span className="text-[9px] text-slate-500 truncate">{att.hash?.substring(0, 16) || "no-hash"}...</span>
                        </div>
                      </div>
                      <Badge className={cn(
                        "text-[10px] px-2",
                        attachmentVerdict === "Malicious"
                          ? "bg-rose-500/20 text-rose-500"
                          : attachmentVerdict === "Suspicious"
                            ? "bg-amber-500/20 text-amber-500"
                            : "bg-emerald-500/20 text-emerald-500"
                      )}>
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

          {/* IP Intelligence */}
          <Card className="bg-white/5 border-white/5">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Globe className="w-5 h-5 text-amber-500" />
                  IP Telemetry
                </CardTitle>
                <CardDescription>Network origin and reputation analysis.</CardDescription>
              </div>
              {verdict === "Malicious" && ip_analysis.results?.length > 0 && (
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
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ip_analysis.results?.length > 0 ? (
                  ip_analysis.results.map((ip: IpTelemetryItem, i: number) => (
                    <div key={i} className="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-mono text-white">{ip.ip}</span>
                        <Badge className={cn(
                          "text-[10px]",
                          ip.abuseipdb?.abuse_score > 50 ? "bg-rose-500/20 text-rose-500" : "bg-emerald-500/20 text-emerald-500"
                        )}>
                          Abuse Score: {ip.abuseipdb?.abuse_score || 0}%
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="flex flex-col">
                          <span className="text-slate-500 uppercase font-bold">Country</span>
                          <span className="text-slate-300">{ip.abuseipdb?.country || "Unknown"}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-slate-500 uppercase font-bold">ISP</span>
                          <span className="text-slate-300 truncate" title={ip.abuseipdb?.isp}>{ip.abuseipdb?.isp || "Unknown"}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="col-span-2 text-xs text-slate-500 text-center py-4 italic">No external IP origin data available.</p>
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
