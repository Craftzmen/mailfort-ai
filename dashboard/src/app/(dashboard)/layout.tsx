"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Shield,
  LayoutDashboard,
  Inbox,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Threat Logs", href: "/emails", icon: Inbox },
  { name: "API Docs", href: "/docs", icon: FileText },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const isAuthenticated =
    typeof window !== "undefined" && Boolean(localStorage.getItem("authToken"));

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") {
      return;
    }

    const normalizedQuery = searchQuery.trim();
    router.push(
      normalizedQuery
        ? `/emails?q=${encodeURIComponent(normalizedQuery)}`
        : "/emails"
    );
  };

  // Auth guard — runs only on client after hydration
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userRole");
    router.replace("/login");
  };

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Shield className="w-12 h-12 text-primary animate-pulse" />
          <p className="text-slate-500 text-sm font-mono uppercase tracking-widest animate-pulse">
            Verifying Credentials...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-inter">
      {/* Sidebar */}
      <aside
        className={cn(
          "relative z-20 flex flex-col h-full bg-slate-900/50 border-r border-white/5 backdrop-blur-md transition-all duration-300 ease-in-out",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-6 h-20 border-b border-white/5">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          {isSidebarOpen && (
            <span className="font-outfit font-bold text-xl tracking-tight text-white">
              MailFort{" "}
              <span className="text-primary text-xs ml-1 px-1.5 py-0.5 rounded bg-primary/20">
                AI
              </span>
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                <item.icon
                  className={cn(
                    "w-5 h-5 min-w-[20px]",
                    isActive
                      ? "text-primary"
                      : "text-slate-400 group-hover:text-white"
                  )}
                />
                {isSidebarOpen && (
                  <span className="font-medium text-sm whitespace-nowrap">
                    {item.name}
                  </span>
                )}
                {isActive && !isSidebarOpen && (
                  <div className="absolute left-0 w-1 h-6 bg-primary rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User / Bottom Actions */}
        <div className="p-3 border-t border-white/5 space-y-1">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            {isSidebarOpen ? (
              <X className="w-5 h-5 min-w-[20px]" />
            ) : (
              <Menu className="w-5 h-5 min-w-[20px]" />
            )}
            {isSidebarOpen && (
              <span className="text-sm font-medium">Collapse Menu</span>
            )}
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all font-medium"
          >
            <LogOut className="w-5 h-5 min-w-[20px]" />
            {isSidebarOpen && <span className="text-sm">Finalize Session</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-primary/10 blur-[100px] rounded-full z-0" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-blue-500/5 blur-[100px] rounded-full z-0" />

        {/* Header */}
        <header className="relative z-10 h-20 border-b border-white/5 flex items-center justify-between px-8 bg-slate-950/20 backdrop-blur-sm">
          <div className="flex items-center gap-6 flex-1 max-w-xl">
            <div className="relative w-full group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search threat identifiers, IPs, or domains..."
                className="w-full pl-10 h-10 bg-white/5 border-white/10 focus:border-primary/50 text-sm transition-all text-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="relative rounded-full hover:bg-white/5 text-slate-400 hover:text-white"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-slate-950" />
            </Button>

            <div className="h-8 w-px bg-white/10 mx-2" />

            <div className="flex items-center gap-3 pl-2">
              <div className="flex flex-col items-end">
                <span className="text-sm font-semibold text-white">
                  SOC Analyst
                </span>
                <span className="text-[10px] text-slate-500 font-mono tracking-wider">
                  SEC-LEVEL-04
                </span>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-blue-600 p-[1px]">
                <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-xs font-bold text-white uppercase">
                  SA
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
