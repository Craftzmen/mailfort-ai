"use client";

import React, { useState, useEffect } from "react";
import { 
  Settings, 
  Server, 
  Database, 
  Shield, 
  Key, 
  Trash2, 
  RefreshCcw, 
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  Info,
  X
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { emailsService, systemService } from "@/services/api";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [health, setHealth] = useState<{ status: string; service: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const data = await systemService.healthCheck();
      setHealth(data);
    } catch (error) {
      console.error("Health check failed:", error);
      setHealth({ status: "error", service: "Offline" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleClearLogs = async () => {
    if (!confirm("Are you sure you want to delete all threat logs? This action cannot be undone.")) {
      return;
    }

    setIsClearing(true);
    try {
      const result = await emailsService.clearAllEmails();
      setNotification({
        type: "success",
        message: `Successfully deleted ${result.deleted} log entries.`,
      });
    } catch (error) {
      setNotification({
        type: "error",
        message: "Failed to clear logs.",
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="space-y-1">
        <h2 className="text-3xl font-bold tracking-tight text-white font-outfit">System Settings</h2>
        <p className="text-slate-400">Manage your MailFort AI configuration and system state.</p>
      </div>

      {notification && (
        <div className={cn(
          "p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300",
          notification.type === "success" 
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" 
            : "bg-rose-500/10 border-rose-500/20 text-rose-500"
        )}>
          {notification.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{notification.message}</span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="ml-auto h-6 w-6 hover:bg-white/5" 
            onClick={() => setNotification(null)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* System Status */}
        <Card className="bg-white/5 border-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Server className="w-5 h-5 text-primary" />
              Service Status
            </CardTitle>
            <CardDescription>Real-time backend health information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-white/5">
              <span className="text-sm text-slate-400">Core API Server</span>
              {loading ? (
                <RefreshCcw className="w-4 h-4 animate-spin text-slate-500" />
              ) : health?.status === "ok" ? (
                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Operational</Badge>
              ) : (
                <Badge variant="destructive">Offline</Badge>
              )}
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-white/5">
              <span className="text-sm text-slate-400">ML Engine</span>
              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Ready</Badge>
            </div>
          </CardContent>
          <CardFooter>
             <Button variant="ghost" size="sm" onClick={checkHealth} className="text-xs text-primary hover:text-white group">
                <RefreshCcw className="w-3 h-3 mr-2 group-hover:rotate-180 transition-transform" />
                Refresh Status
             </Button>
          </CardFooter>
        </Card>

        {/* Database Management */}
        <Card className="bg-white/5 border-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="w-5 h-5 text-blue-500" />
              Data Management
            </CardTitle>
            <CardDescription>Control the persistence layer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/10 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <h4 className="text-sm font-bold text-white">Danger Zone</h4>
              </div>
              <p className="text-xs text-slate-400">Deleting threat logs is permanent and will clear all historical analysis data.</p>
              <Button 
                variant="destructive" 
                size="sm" 
                className="w-full bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all"
                onClick={handleClearLogs}
                disabled={isClearing}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {isClearing ? "Clearing..." : "Clear Threat History"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security & API Keys */}
      <Card className="bg-white/5 border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Key className="w-5 h-5 text-amber-500" />
            Integrations & API Keys
          </CardTitle>
          <CardDescription>External threat intelligence configurations loaded from .env</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: "VirusTotal", status: "Configured", icon: Shield, color: "text-primary" },
              { name: "AbuseIPDB", status: "Configured", icon: Info, color: "text-amber-500" },
              { name: "OpenPhish", status: "Local DB Active", icon: Shield, color: "text-emerald-500" },
              { name: "ML Confidence", status: "Threshold 70%", icon: CheckCircle2, color: "text-blue-500" },
            ].map((key, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-white/5 group hover:border-white/10 transition-all">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg bg-white/5", key.color)}>
                    <key.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{key.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">ID: {key.name.toUpperCase()}_PROVIDER</div>
                  </div>
                </div>
                <Badge variant="outline" className="border-white/10 text-slate-400">{key.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
