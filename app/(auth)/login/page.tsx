// app/(auth)/login/page.tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      return toast.error("Please enter both email and password.");
    }

    startTransition(async () => {
      const res = await signInAction(email, password);
      if (res?.error) {
        toast.error("Authentication failed", {
          description: res.error,
        });
      } else {
        toast.success("Successfully logged in!");
        router.push("/board");
        router.refresh();
      }
    });
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ backgroundColor: "#1E1E1E" }}
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-800 p-8 shadow-2xl space-y-6" style={{ backgroundColor: "#1A1A1A" }}>
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
            <span className="text-white font-black text-xl">S</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Welcome to SmartScore</h1>
          <p className="text-sm text-zinc-400">Sign in to access your Kanban operations board</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-zinc-300">
              Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
              <Input
                id="email"
                type="email"
                placeholder="you@smartscore.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#2D2D2D] border-zinc-700 text-white placeholder:text-zinc-500 pl-10"
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-zinc-300">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-[#2D2D2D] border-zinc-700 text-white placeholder:text-zinc-500 pl-10"
                disabled={isPending}
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-2 py-5"
          >
            {isPending ? "Signing In..." : "Sign In"}
          </Button>
        </form>

        {/* Footer */}
        <div className="text-center text-xs text-zinc-500">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-blue-500 hover:underline hover:text-blue-400 font-medium">
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
