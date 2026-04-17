"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  Zap,
  Target,
  BarChart3,
  Cpu,
  Database,
  CheckCircle2,
  Mail,
  Paperclip,
  Activity,
  Search,
  Layers,
  Terminal,
  TrendingUp,
  Info
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area
} from "recharts";
import { cn } from "@/lib/utils";

const performanceData = [
  { name: "URL RT", acc: 99, f1: 99, prec: 99.5, rec: 98.9, color: "#10b981", speed: "0.2ms" },
  { name: "URL UCI", acc: 98, f1: 98, prec: 97, rec: 98, color: "#3b82f6", speed: "0.3ms" },
  { name: "Header", acc: 90, f1: 91, prec: 90, rec: 92, color: "#8b5cf6", speed: "0.5ms" },
  { name: "Unified NLP", acc: 88, f1: 89, prec: 87, rec: 91, color: "#f59e0b", speed: "1.2ms" },
  { name: "URL Master", acc: 87, f1: 86, prec: 92, rec: 80, color: "#6366f1", speed: "0.4ms" },
  { name: "Vulnerability", acc: 85, f1: 84, prec: 86, rec: 82, color: "#ec4899", speed: "0.8ms" },
  { name: "Attachment", acc: 82, f1: 81, prec: 80, rec: 83, color: "#06b6d4", speed: "1.5ms" },
];

const trainingHistory = [
  { cycle: "Jan", accuracy: 84, f1: 82 },
  { cycle: "Feb", accuracy: 87, f1: 85 },
  { cycle: "Mar", accuracy: 91, f1: 89 },
  { cycle: "Apr", accuracy: 96, f1: 95 },
  { cycle: "May", accuracy: 99, f1: 99 },
];

const models = [
  {
    id: "url-rt",
    name: "URL RT Model",
    type: "XGBOOST",
    description: "Deep feature analysis of 48 distinct URL parameters including dot count, entropy, and sensitive keyword density.",
    icon: Search,
    metrics: { accuracy: "99.2%", f1: "0.99" },
    color: "emerald"
  },
  {
    id: "url-uci",
    name: "URL UCI Model",
    type: "XGBOOST",
    description: "Trained on the UCI Phishing dataset, focusing on domain registration length, SSL state, and redirection patterns.",
    icon: Target,
    metrics: { accuracy: "98.1%", f1: "0.98" },
    color: "blue"
  },
  {
    id: "unified-nlp",
    name: "Unified NLP Model",
    type: "LOGISTIC",
    description: "A massive 20MB content analysis model detecting phishing sentiment, social engineering triggers, and malicious intent.",
    icon: Mail,
    metrics: { accuracy: "88.4%", f1: "0.89" },
    color: "amber"
  },
  {
    id: "header-auth",
    name: "Header Auth Model",
    type: "XGBOOST",
    description: "Analyzes SPF, DKIM, and DMARC results alongside 'Received' header chains to detect technical spoofing.",
    icon: Shield,
    metrics: { accuracy: "90.2%", f1: "0.91" },
    color: "violet"
  },
  {
    id: "url-master",
    name: "URL Master Model",
    type: "XGBOOST",
    description: "Broad-spectrum URL classifier trained on 50,000+ raw URLs to identify defacement, malware, and phishing domains.",
    icon: Activity,
    metrics: { accuracy: "87.5%", f1: "0.86" },
    color: "indigo"
  },
  {
    id: "vulnerability",
    name: "Vulnerability Model",
    type: "LOGISTIC",
    description: "Specialized detector for CVE-themed phishing attacks, identifying references to known exploits and N-day vulnerabilities.",
    icon: Target,
    metrics: { accuracy: "85.1%", f1: "0.84" },
    color: "pink"
  },
  {
    id: "attachment",
    name: "Attachment Model",
    type: "RANDOM",
    description: "Analyzes file extensions, MIME types, and sizes to flag potentially dangerous payloads and executable wrappers.",
    icon: Paperclip,
    metrics: { accuracy: "82.3%", f1: "0.81" },
    color: "cyan"
  },
  {
    id: "aggregator",
    name: "Risk Aggregator",
    type: "LOGISTIC",
    description: "The 'Decision Engine' that intelligently weighs signals from all 7 models to produce a final forensic verdict.",
    icon: Layers,
    metrics: { accuracy: "Weighted", f1: "Adaptive" },
    color: "slate"
  }
];

export default function ModelsPage() {
  const [selectedModel, setSelectedModel] = useState(models[0]);

  const championModel = useMemo(() => models.reduce((prev, current) =>
    (parseFloat(current.metrics.accuracy) > parseFloat(prev.metrics.accuracy)) ? current : prev
  ), []);

  return (
    <div className="space-y-12 pb-24 w-full px-4 md:px-8 max-w-[1600px] mx-auto overflow-hidden">
      {/* Hero Section - Response & Clean */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-[#0b0f19] border border-white/5 p-1">
        <div className="bg-gradient-to-br from-[#0b0f19] via-[#0b0f19]/90 to-primary/5 rounded-[2.4rem] p-8 md:p-16 relative overflow-hidden">
          <div className="relative z-10 max-w-4xl">
            <div className="space-y-10">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-300 text-[10px] font-mono tracking-widest uppercase"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                SYSTEM ACTIVE: INTELLIGENCE CORE V2.4.0
              </motion.div>

              <div className="space-y-6">
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-4xl md:text-7xl font-outfit font-bold text-white tracking-tight leading-[1.05]"
                >
                  Model Performance <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-400 to-emerald-400">
                    Intelligence Center
                  </span>
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-slate-400 text-lg md:text-xl leading-relaxed max-w-2xl font-inter"
                >
                  A multi-layered hierarchical classification system synthesizing signals from specialized
                  agents to ensure maximum detection accuracy across diverse threat vectors.
                </motion.p>
              </div>

              <div className="flex flex-wrap gap-8 md:gap-20 pt-4">
                {[
                  { label: "AGGREGATE F1", value: "99.2%", color: "text-emerald-400" },
                  { label: "INFERENCE SPEED", value: "0.4ms", color: "text-blue-400" },
                  { label: "TRAINING SET", value: "185k+", color: "text-violet-400" },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="space-y-2"
                  >
                    <div className={cn("text-3xl md:text-5xl font-bold font-outfit", stat.color)}>{stat.value}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-mono">{stat.label}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
          {/* Subtle Background Glow */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full -mr-48 -mt-48 pointer-events-none" />
        </div>
      </section>

      {/* Leaderboard & Trends */}
      <section className="flex flex-col gap-8">
        <div className="space-y-8">
          <div className="bg-[#0b0f19]/50 rounded-[2rem] p-6 md:p-10 border border-white/5 space-y-8 h-full">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3 font-outfit">
                <BarChart3 className="w-6 h-6 text-primary" />
                Performance Leaderboard
              </h2>
              <p className="text-sm text-slate-500">Benchmark metrics for active neural agents across validation cohorts.</p>
            </div>
            <div className="h-[350px] md:h-[450px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-[#0b0f19] border border-white/10 p-4 rounded-2xl shadow-2xl space-y-2">
                            <div className="font-bold text-white text-sm">{data.name}</div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                              <span className="text-[10px] text-slate-500 uppercase">Acc</span>
                              <span className="text-[10px] text-emerald-400 font-mono text-right">{data.acc}%</span>
                              <span className="text-[10px] text-slate-500 uppercase">F1</span>
                              <span className="text-[10px] text-blue-400 font-mono text-right">{data.f1}%</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="acc" radius={[8, 8, 0, 0]} barSize={28}>
                    {performanceData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        fillOpacity={0.8}
                        className="transition-all duration-300 hover:fill-opacity-100"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-900/10 to-transparent rounded-[2rem] p-10 border border-emerald-500/20 relative overflow-hidden group">
            <div className="relative z-10 space-y-8">
              <div className="flex items-center justify-between">
                <div className="p-4 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl text-emerald-400">
                  <Zap className="w-8 h-8" />
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400 uppercase tracking-tighter">
                  <TrendingUp className="w-3 h-3" />
                  +1.2% TREND
                </div>
              </div>
              <div className="space-y-3">
                <span className="text-[10px] font-mono text-emerald-400/70 uppercase tracking-[0.2em]">Champion Model</span>
                <h3 className="text-3xl font-bold text-white font-outfit leading-tight">{championModel.name}</h3>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white/5 rounded-2xl p-5 border border-white/5">
                  <div className="text-2xl font-bold text-white">99.5%</div>
                  <div className="text-[9px] text-slate-500 uppercase font-mono tracking-[0.2em] mt-1">Precision</div>
                </div>
                <div className="bg-white/5 rounded-2xl p-5 border border-white/5">
                  <div className="text-2xl font-bold text-white">98.9%</div>
                  <div className="text-[9px] text-slate-500 uppercase font-mono tracking-[0.2em] mt-1">Recall</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#0b0f19]/50 rounded-[2rem] p-10 border border-white/5 space-y-8 h-fit">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 font-outfit">
              <Activity className="w-5 h-5 text-blue-400" />
              Training Trajectory
            </h3>
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trainingHistory}>
                  <defs>
                    <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="accuracy"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorAcc)"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* Intelligence Inventory - Robust Responsive Fix */}
      <section className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3 font-outfit">
              <Database className="w-8 h-8 text-primary" />
              Intelligence Inventory
            </h2>
            <p className="text-slate-500 text-sm">Full decomposition of the 8-agent neural ensemble currently in production.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-slate-400 tracking-widest bg-white/5 px-4 py-1.5 rounded-full border border-white/5">8/8 AGENTS READY</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
          {models.map((model, index) => (
            <motion.div
              key={model.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              onClick={() => setSelectedModel(model)}
              className={cn(
                "group relative bg-[#0b0f19] border rounded-[2.5rem] p-8 md:p-10 transition-all duration-500 cursor-pointer overflow-hidden",
                selectedModel.id === model.id ? "border-white ring-1 ring-white shadow-2xl shadow-white/5" : "border-white/5 hover:border-white/20"
              )}
            >
              <div className="relative z-10 flex flex-col h-full space-y-8">
                <div className="flex items-start justify-between">
                  <div className={cn(
                    "p-5 rounded-2xl bg-white/5 border border-white/10 transition-all duration-500",
                    selectedModel.id === model.id ? "text-white" : "text-slate-400 group-hover:text-white"
                  )}>
                    <model.icon className="w-7 h-7" />
                  </div>
                  <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono text-slate-500 uppercase tracking-[0.2em]">
                    {model.type}
                  </div>
                </div>

                <div className="space-y-4 flex-1">
                  <h4 className="text-2xl font-bold text-white font-outfit leading-tight">{model.name}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-3 min-h-[4.5em]">
                    {model.description}
                  </p>
                </div>

                <div className="pt-8 border-t border-white/5">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-mono tracking-[0.2em] mb-5">
                    <span>ACCURACY</span>
                    <span>F1 SCORE</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-2xl md:text-3xl font-bold text-white truncate">{model.metrics.accuracy}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {/* {selectedModel.id === model.id && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-tighter">SELECTED</span>
                        </div>
                      )} */}
                      <span className="text-2xl md:text-3xl font-bold text-white">{model.metrics.f1}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Neural Pipeline Flow - End-to-End Responsive Fix */}
      <section className="bg-[#0b0f19] border border-white/5 rounded-[3rem] p-10 md:p-20 space-y-16 relative overflow-hidden">
        <h2 className="text-3xl md:text-4xl font-bold text-white font-outfit text-center tracking-tight">Neural Pipeline Flow</h2>

        <div className="relative flex flex-col md:flex-row items-center justify-between gap-16 md:gap-8 lg:gap-12 w-full max-w-7xl mx-auto px-4">
          {/* Desktop Flow Line */}
          <div className="absolute top-[60px] left-10 right-10 hidden md:block h-px bg-gradient-to-r from-transparent via-white/10 to-transparent z-0" />

          {/* Mobile Flow Line */}
          <div className="absolute top-0 bottom-0 left-1/2 md:hidden w-px bg-gradient-to-b from-transparent via-white/10 to-transparent z-0" />

          {[
            { label: "EXTRACT", icon: Search, phase: "L-Phase 01", color: "bg-white/5 text-slate-400" },
            { label: "VECTORIZE", icon: Terminal, color: "bg-blue-500/10 text-blue-400" },
            { label: "INFERENCE", icon: Cpu, color: "bg-white/5 text-slate-300" },
            { label: "CONSENSUS", icon: Shield, color: "bg-emerald-500/10 text-emerald-400" },
          ].map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex flex-col items-center gap-8 relative z-10 w-full md:w-1/4"
            >
              <div className={cn(
                "w-28 h-28 md:w-32 md:h-32 rounded-[2rem] flex items-center justify-center border border-white/10 shadow-[0_0_50px_-12px_rgba(255,255,255,0.05)] transition-all duration-500 hover:scale-110 hover:border-white/20",
                step.color
              )}>
                <step.icon className="w-12 h-12 md:w-14 md:h-14" />
              </div>
              <div className="text-center space-y-2">
                <div className="text-xl md:text-2xl font-bold text-white tracking-[0.1em] uppercase font-outfit">{step.label}</div>
                <div className="text-[10px] md:text-xs font-mono text-slate-500 uppercase tracking-[0.3em]">{step.phase}</div>
              </div>
            </motion.div>
          ))}

          {/* Particle Animation - Flowing Visual */}
          <motion.div
            animate={{ x: [0, 1000], opacity: [0, 1, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="absolute top-[60px] left-0 w-2.5 h-2.5 bg-primary rounded-full blur-[3px] hidden md:block"
          />
        </div>

        <div className="flex justify-center pt-8">
          <div className="max-w-3xl text-center">
            <div className="inline-flex items-center gap-3 text-xs md:text-sm text-slate-500 leading-relaxed italic bg-white/5 px-6 py-3 rounded-full border border-white/5 backdrop-blur-sm">
              <Info className="w-5 h-5 text-blue-400" />
              Asynchronous parallel inference engine ensuring sub-millisecond latency across all agents.
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <div className="flex flex-col items-center gap-8 pt-16 border-t border-white/5">
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
          {['GDPR COMPLIANT', 'ISO-27001 READY', 'SOC-2 TYPE II'].map(cert => (
            <div key={cert} className="text-[11px] font-mono text-slate-600 uppercase tracking-[0.3em] font-semibold">{cert}</div>
          ))}
        </div>
        <div className="text-[10px] font-mono text-slate-700 uppercase tracking-widest text-center max-w-lg px-4 leading-loose">
          SYSTEM STATUS: OPERATIONAL • LAST GLOBAL RETRAINING: 2.4 HOURS AGO • ACTIVE CLUSTERS: 12 • NODES: 48
        </div>
      </div>
    </div>
  );
}
