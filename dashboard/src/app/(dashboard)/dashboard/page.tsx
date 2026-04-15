"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { 
  ShieldAlert, 
  ShieldCheck, 
  ShieldQuestion, 
  BarChart3, 
  TrendingUp, 
  ArrowUpRight,
  Clock,
  Mail
} from "lucide-react";
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { emailsService, Stats, EmailLog } from "@/services/api";
import { format } from "date-fns";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

type TrendPoint = {
  time: string;
  threats: number;
  safe: number;
};

function buildTrendData(emails: EmailLog[]): TrendPoint[] {
  const bucketCount = 6;
  const bucketSizeMs = 4 * 60 * 60 * 1000;
  const now = new Date();
  const windowStart = now.getTime() - bucketCount * bucketSizeMs;

  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStartMs = windowStart + index * bucketSizeMs;
    return {
      time: format(new Date(bucketStartMs), "HH:mm"),
      threats: 0,
      safe: 0,
    };
  });

  for (const email of emails) {
    const timestamp = new Date(email.created_at).getTime();
    if (Number.isNaN(timestamp) || timestamp < windowStart) {
      continue;
    }

    const bucketIndex = Math.min(
      bucketCount - 1,
      Math.max(0, Math.floor((timestamp - windowStart) / bucketSizeMs))
    );

    if (email.verdict === "Safe") {
      buckets[bucketIndex].safe += 1;
    } else {
      buckets[bucketIndex].threats += 1;
    }
  }

  return buckets;
}

export default function DashboardOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentEmails, setRecentEmails] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [statsData, emailsData] = await Promise.all([
        emailsService.getStats(),
        emailsService.getEmails(0, 300),
      ]);
      setStats(statsData);
      setRecentEmails(emailsData);
      setFetchError(null);
    } catch (error) {
      console.error("Failed to fetch dashboard metrics:", error);
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          setFetchError("Dashboard cannot reach the backend API. Verify backend is running and frontend proxy is configured.");
        } else {
          const responseDetail =
            typeof error.response.data === "string"
              ? error.response.data
              : (error.response.data as { detail?: unknown } | undefined)?.detail;
          const normalizedDetail =
            typeof responseDetail === "string" && responseDetail.trim().length > 0
              ? ` ${responseDetail}`
              : "";
          setFetchError(`Backend request failed (${error.response.status}).${normalizedDetail}`);
        }
      } else {
        setFetchError("Unable to load dashboard metrics due to an unexpected error.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = window.setInterval(fetchDashboardData, 15000);
    return () => window.clearInterval(interval);
  }, [fetchDashboardData]);

  const total = stats?.total || 0;
  const safe = stats?.breakdown.Safe || 0;
  const suspicious = stats?.breakdown.Suspicious || 0;
  const malicious = stats?.breakdown.Malicious || 0;
  const threats = suspicious + malicious;
  const safeRate = total > 0 ? (safe / total) * 100 : 0;

  const trendData = useMemo(() => buildTrendData(recentEmails), [recentEmails]);

  const pieData = [
    { name: "Safe", value: safe, color: "#10b981" },
    { name: "Suspicious", value: suspicious, color: "#f59e0b" },
    { name: "Malicious", value: malicious, color: "#ef4444" },
  ];

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Page Heading */}
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold tracking-tight text-white font-outfit">Security Posture Overview</h2>
        <p className="text-slate-400">Real-time threat intelligence and system metrics.</p>
      </div>

      {fetchError ? (
        <Card className="bg-rose-500/10 border-rose-500/30">
          <CardContent className="pt-6">
            <p className="text-sm text-rose-200">{fetchError}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div variants={item}>
          <Card className="bg-white/5 border-white/5 overflow-hidden group hover:border-primary/50 transition-colors">
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-400 font-medium">Total Analyzed</CardDescription>
              <CardTitle className="text-3xl font-bold text-white flex items-center justify-between">
                {loading ? "..." : total}
                <Mail className="w-5 h-5 text-primary opacity-50 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1 text-xs text-emerald-500 font-medium">
                <ArrowUpRight className="w-3 h-3" />
                <span>Live ingestion active</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="bg-white/5 border-white/5 overflow-hidden group hover:border-emerald-500/50 transition-colors">
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-400 font-medium">Clean Verdicts</CardDescription>
              <CardTitle className="text-3xl font-bold text-emerald-500 flex items-center justify-between">
                {loading ? "..." : safe}
                <ShieldCheck className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1 text-xs text-emerald-500/80 font-medium">
                <span className="text-slate-500">System Integrity:</span> {safeRate.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="bg-white/5 border-white/5 overflow-hidden group hover:border-amber-500/50 transition-colors">
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-400 font-medium">Suspicious</CardDescription>
              <CardTitle className="text-3xl font-bold text-amber-500 flex items-center justify-between">
                {loading ? "..." : suspicious}
                <ShieldQuestion className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1 text-xs text-amber-500/80 font-medium">
                <Clock className="w-3 h-3" />
                <span>{suspicious} pending review</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="bg-white/5 border-white/5 overflow-hidden group hover:border-rose-500/50 transition-colors">
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-400 font-medium">Malicious Blocked</CardDescription>
              <CardTitle className="text-3xl font-bold text-rose-500 flex items-center justify-between">
                {loading ? "..." : malicious}
                <ShieldAlert className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1 text-xs text-rose-500/80 font-medium">
                <ArrowUpRight className="w-3 h-3" />
                <span>{threats} active threat indicators</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <motion.div variants={item} className="xl:col-span-2">
          <Card className="bg-white/5 border-white/5 h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-8">
              <div className="space-y-1">
                <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Threat Distribution (24h)
                </CardTitle>
                <CardDescription className="text-slate-400">Computed from the latest telemetry window (auto-refresh every 15s).</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                 <div className="flex items-center gap-1.5">
                   <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                   <span className="text-[10px] text-slate-400 uppercase font-mono">Safe</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                   <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                   <span className="text-[10px] text-slate-400 uppercase font-mono">Threats</span>
                 </div>
              </div>
            </CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorSafe" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorThreat" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis 
                    dataKey="time" 
                    stroke="#64748b" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="safe" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorSafe)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="threats" 
                    stroke="#ef4444" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorThreat)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="bg-white/5 border-white/5 h-full">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-amber-500" />
                Verdict Allocation
              </CardTitle>
              <CardDescription className="text-slate-400">Proportional classification breakdown.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-3 w-full mt-4 gap-2">
                {pieData.map((item, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">{item.name}</span>
                    <span className="text-sm font-bold" style={{ color: item.color }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
