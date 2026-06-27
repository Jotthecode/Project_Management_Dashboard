// app/(auth)/signup/page.tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUpAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Mail, User } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!fullName.trim()) return toast.error("Full name is required.");
    if (!email.trim()) return toast.error("Email address is required.");
    if (!password.trim()) return toast.error("Password is required.");
    if (password.length < 6) return toast.error("Password must be at least 6 characters.");
    if (password !== confirmPassword) return toast.error("Passwords do not match.");

    startTransition(async () => {
      const res = await signUpAction(email, password, fullName.trim());
      if (res?.error) {
        toast.error("Registration failed", {
          description: res.error,
        });
      } else {
        toast.success("Account created successfully!", {
          description: "Sign in with your new credentials.",
        });
        router.push("/login");
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
          <div className="mx-auto flex h-10 px-3 items-center justify-center rounded-lg bg-blue-600 w-fit">
            <span className="text-white font-black text-lg tracking-wider">SCC</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Create Account</h1>
          <p className="text-sm text-zinc-400">Join SCC (SmartScore Command Center 📡)</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-zinc-300">
              Full Name
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
              <Input
                id="name"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bg-[#2D2D2D] border-zinc-700 text-white placeholder:text-zinc-500 pl-10"
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-zinc-300">
              Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
              <Input
                id="email"
                type="email"
                placeholder="you@scc.com"
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
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-[#2D2D2D] border-zinc-700 text-white placeholder:text-zinc-500 pl-10"
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-zinc-300">
              Confirm Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
            {isPending ? "Creating Account..." : "Create Account"}
          </Button>
        </form>

        {/* Footer */}
        <div className="text-center text-xs text-zinc-500">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-500 hover:underline hover:text-blue-400 font-medium">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
