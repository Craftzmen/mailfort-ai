"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { 
  Search, 
  ExternalLink, 
  FileText,
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  RefreshCcw,
  ArrowUpDown,
  Inbox
} from "lucide-react";
import { format } from "date-fns";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { emailsService, EmailLog } from "@/services/api";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

function EmailLogsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryFromUrl = (searchParams.get("q") || "").trim();
  
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(queryFromUrl);
  const [activeSearch, setActiveSearch] = useState(queryFromUrl);
  const [verdictFilter, setVerdictFilter] = useState<string>("All");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const updateSearchInUrl = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("q", value);
      } else {
        params.delete("q");
      }

      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    setSearch(queryFromUrl);
    setActiveSearch(queryFromUrl);
    setPage(1);
  }, [queryFromUrl]);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      if (activeSearch) {
        const response = await emailsService.searchEmails(
          activeSearch,
          PAGE_SIZE,
          (page - 1) * PAGE_SIZE,
          verdictFilter === "All" ? undefined : verdictFilter
        );
        setEmails(response.items);
        setTotalCount(response.total);
      } else {
        const [data, stats] = await Promise.all([
          emailsService.getEmails(
            (page - 1) * PAGE_SIZE,
            PAGE_SIZE,
            verdictFilter === "All" ? undefined : verdictFilter
          ),
          emailsService.getStats(),
        ]);
        setEmails(data);
        setTotalCount(
          verdictFilter === "All"
            ? stats.total
            : stats.breakdown[verdictFilter as keyof typeof stats.breakdown] || 0
        );
      }
    } catch (error) {
      console.error("Failed to fetch emails:", error);
    } finally {
      setLoading(false);
    }
  }, [activeSearch, verdictFilter, page]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  const applySearch = () => {
    const normalizedQuery = search.trim();
    setPage(1);
    setActiveSearch(normalizedQuery);
    updateSearchInUrl(normalizedQuery);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const firstRowNumber = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRowNumber = Math.min(page * PAGE_SIZE, totalCount);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      applySearch();
    }
  };

  const filteredEmails = emails; // API handles filtering now if search is provided

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case "Safe":
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20 gap-1"><CheckCircle2 className="w-3 h-3" /> Safe</Badge>;
      case "Suspicious":
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20 gap-1"><AlertTriangle className="w-3 h-3" /> Suspicious</Badge>;
      case "Malicious":
        return <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20 gap-1"><XCircle className="w-3 h-3" /> Malicious</Badge>;
      default:
        return <Badge variant="outline">{verdict}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight text-white font-outfit">Threat Intelligence Logs</h2>
          <p className="text-slate-400">Reviewing and analyzing captured email traffic.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-white/5 border-white/10 text-slate-300 hover:text-white"
            onClick={fetchEmails}
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            Sync Logs
          </Button>
          <Button size="sm" className="bg-primary hover:bg-primary/90">
             Export CSV
          </Button>
        </div>
      </div>

      <Card className="bg-white/5 border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/40">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Filter by sender or subject..." 
              className="pl-10 bg-slate-950/50 border-white/10 focus:border-primary/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="bg-white/5 border-white/10 text-slate-300 hover:text-white"
            onClick={applySearch}
          >
            Apply Search
          </Button>
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
            {["All", "Safe", "Suspicious", "Malicious"].map((v) => (
              <button
                key={v}
                onClick={() => {
                  setVerdictFilter(v);
                  setPage(1);
                }}
                className={cn(
                  "px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all border shadow-sm",
                  verdictFilter === v 
                    ? "bg-white text-slate-900 border-white" 
                    : "bg-slate-900/60 border-slate-700 text-slate-300 hover:text-white hover:border-slate-500"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-950/40">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-slate-400 font-semibold w-75">
                  <div className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                    Sender <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead className="text-slate-400 font-semibold">Subject</TableHead>
                <TableHead className="text-slate-400 font-semibold">Detection Verdict</TableHead>
                <TableHead className="text-slate-400 font-semibold text-right">
                  <div className="flex items-center justify-end gap-2 cursor-pointer hover:text-white transition-colors">
                    Received <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-white/5 animate-pulse">
                     <TableCell><div className="h-4 bg-white/5 rounded w-full" /></TableCell>
                     <TableCell><div className="h-4 bg-white/5 rounded w-full" /></TableCell>
                     <TableCell><div className="h-6 bg-white/5 rounded w-24" /></TableCell>
                     <TableCell><div className="h-4 bg-white/5 rounded w-32 ml-auto" /></TableCell>
                     <TableCell><div className="h-4 bg-white/5 rounded w-8" /></TableCell>
                  </TableRow>
                ))
              ) : filteredEmails.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-64 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                      <Inbox className="w-12 h-12 opacity-20" />
                      <p>No telemetry data found for the current filter selection.</p>
                      <Button
                        variant="link"
                        onClick={() => {
                          setSearch("");
                          setActiveSearch("");
                          setVerdictFilter("All");
                          setPage(1);
                          updateSearchInUrl("");
                        }}
                        className="text-primary p-0"
                      >
                        Clear all filters
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmails.map((email) => (
                  <TableRow key={email.id} className="border-white/5 hover:bg-white/5 transition-colors group">
                    <TableCell className="font-medium text-slate-200">{email.sender}</TableCell>
                    <TableCell className="text-slate-400 truncate max-w-100">{email.subject}</TableCell>
                    <TableCell>{getVerdictBadge(email.verdict)}</TableCell>
                    <TableCell className="text-right text-slate-500 font-mono text-xs whitespace-nowrap">
                       {format(new Date(email.created_at), "yyyy-MM-dd HH:mm:ss")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/emails/${email.id}#forensic-report`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 group-hover:text-sky-400 group-hover:bg-sky-500/10 transition-all"
                            title="Open generated report"
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Link href={`/emails/${email.id}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 group-hover:text-primary group-hover:bg-primary/10 transition-all"
                            title="Open full analysis"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        <div className="p-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-500 bg-slate-900/20">
          <div>
            Showing {firstRowNumber}-{lastRowNumber} of {totalCount} log entries
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Page {page} of {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 bg-transparent border-white/10 hover:bg-white/5 disabled:opacity-30"
              disabled={page <= 1 || loading}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 bg-transparent border-white/10 hover:bg-white/5 disabled:opacity-30"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function EmailLogsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm font-mono uppercase tracking-widest">Loading Telemetry...</p>
        </div>
      </div>
    }>
      <EmailLogsContent />
    </Suspense>
  );
}
