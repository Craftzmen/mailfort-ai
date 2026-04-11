"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, Lock, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (token) {
      router.replace("/dashboard");
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate auth — in production, call a real auth endpoint
    setTimeout(() => {
      localStorage.setItem("authToken", "mailfort-session-token");
      localStorage.setItem("userRole", "admin");
      router.replace("/dashboard");
      setIsLoading(false);
    }, 1200);
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-slate-950">
      {/* Background Grid + Gradient */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 backdrop-blur-sm shadow-2xl shadow-primary/20">
            <Shield className="w-10 h-10 text-primary animate-pulse" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white font-outfit">
            MailFort <span className="text-primary">AI</span>
          </h1>
          <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">
            DFIR Management Console
          </p>
        </div>

        <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-white">
              Identity Access
            </CardTitle>
            <CardDescription className="text-slate-400">
              Enter your credentials to access the DFIR dashboard.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="login-email"
                    type="text"
                    placeholder="Username or Email"
                    className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-primary/50"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="Authorization Key"
                    className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-primary/50"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button
                id="login-submit"
                type="submit"
                className="w-full h-11 text-base font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  "Establish Secure Connection"
                )}
              </Button>
              <div className="text-center">
                <span className="text-xs text-slate-500">
                  Contact SOC administrator for access request
                </span>
              </div>
            </CardFooter>
          </form>
        </Card>

        {/* System Status Footer */}
        <div className="mt-8 flex justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-slate-500 font-mono uppercase">
              Node-Alpha: Operational
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-slate-500 font-mono uppercase">
              ML-Engine: Ready
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
