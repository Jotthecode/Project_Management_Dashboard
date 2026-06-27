"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { User, Sun, Moon, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { updateProfile } from "@/actions/profiles";
import { type Profile } from "@/lib/types";

interface SettingsClientProps {
  profile: Profile;
}

export function SettingsClient({ profile }: SettingsClientProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Profile fields state
  const [fullName, setFullName] = useState(profile.full_name || "");

  // Avoid hydration mismatch by waiting until mounted
  useEffect(() => {
    setMounted(true);
  }, []);

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return toast.error("Full name is required.");

    startTransition(async () => {
      try {
        await updateProfile(fullName.trim());
        toast.success("Profile details updated successfully! 🎉");
        router.refresh();
      } catch (err: any) {
        toast.error(err.message || "Failed to update profile details.");
      }
    });
  }

  return (
    <main className="h-screen w-full overflow-y-auto flex flex-col p-6 space-y-6" style={{ backgroundColor: "#1E1E1E" }}>
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-400">Configure your workspace preferences and profile settings</p>
      </div>

      <div className="max-w-xl space-y-6">
        {/* Theme Settings */}
        <div className="rounded-xl border border-zinc-800 p-6 space-y-4" style={{ backgroundColor: "#2D2D2D" }}>
          <div>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              Theme Configuration
            </h2>
            <p className="text-xs text-zinc-400 mt-1">Select your preferred system theme layout mode</p>
          </div>

          {mounted && (
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex-1 flex items-center justify-center gap-2.5 p-3 rounded-lg border text-xs font-semibold transition-all ${
                  theme === "light"
                    ? "bg-zinc-100 border-zinc-300 text-zinc-950 font-bold"
                    : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-white"
                }`}
              >
                <Sun className="h-4 w-4" />
                Light Mode
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex-1 flex items-center justify-center gap-2.5 p-3 rounded-lg border text-xs font-semibold transition-all ${
                  theme === "dark"
                    ? "bg-zinc-900 border-zinc-700 text-white font-bold"
                    : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-white"
                }`}
              >
                <Moon className="h-4 w-4" />
                Dark Mode
              </button>
            </div>
          )}
        </div>

        {/* Profile Settings */}
        <div className="rounded-xl border border-zinc-800 p-6" style={{ backgroundColor: "#2D2D2D" }}>
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <User className="h-4 w-4 text-blue-400" /> Account Details
            </h2>
            <p className="text-xs text-zinc-400 mt-1">Update your display avatar details and full name identity</p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs font-semibold">Email Address (Read-Only)</Label>
              <Input
                value={profile.email}
                disabled
                className="bg-zinc-900/50 border-zinc-800 text-zinc-500 cursor-not-allowed text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fullNameInput" className="text-zinc-300 text-xs font-semibold">Display Full Name</Label>
              <Input
                id="fullNameInput"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter full name..."
                required
                className="bg-[#1E1E1E] border-zinc-750 text-white text-xs h-9"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="submit"
                disabled={isPending || !fullName.trim() || fullName.trim() === profile.full_name}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2 px-4 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Save Changes
              </Button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
