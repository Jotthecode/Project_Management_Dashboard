// components/sidebar.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Trophy,
  CalendarCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/actions/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SidebarProps {
  profile: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string | null;
  } | null;
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    { name: "Board", href: "/board", icon: LayoutDashboard },
    { name: "Leaderboard", href: "/leaderboard", icon: Trophy },
    { name: "Daily Tasks", href: "/daily", icon: CalendarCheck },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  async function handleSignOut() {
    try {
      await signOutAction();
      toast.success("Signed out successfully");
      router.push("/login");
      router.refresh();
    } catch (err: any) {
      toast.error("Error signing out", {
        description: err.message || "Something went wrong.",
      });
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col h-screen transition-all duration-300 border-r border-zinc-800 shrink-0 select-none",
        isCollapsed ? "w-16" : "w-60"
      )}
      style={{ backgroundColor: "#1A1A1A" }}
    >
      {/* Top Header / Brand */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-zinc-800">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-7 px-1.5 rounded bg-blue-600">
              <span className="text-white font-black text-xs tracking-wider">SCC</span>
            </div>
            <span className="text-white font-bold text-sm tracking-tight truncate max-w-[130px]" title="SmartScore Command Center 📡">
              Command Center 📡
            </span>
          </div>
        )}
        {isCollapsed && (
          <div className="mx-auto flex items-center justify-center h-7 w-7 rounded bg-blue-600">
            <span className="text-white font-black text-[9px]">SCC</span>
          </div>
        )}
        {!isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(true)}
            className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Collapse button for when collapsed */}
      {isCollapsed && (
        <div className="flex justify-center py-2 border-b border-zinc-800/50">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(false)}
            className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Nav Links */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors group",
                isActive
                  ? "bg-blue-600/10 text-blue-400"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-blue-400" : "text-zinc-400 group-hover:text-white"
                )}
              />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User Session Info / Footer */}
      <div className="p-3 border-t border-zinc-800">
        <div className="flex flex-col gap-2">
          {profile && (
            <div className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
              <div className="relative shrink-0">
                <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold uppercase">
                  {profile.full_name?.substring(0, 2) || "U"}
                </div>
              </div>
              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">
                    {profile.full_name}
                  </p>
                  <p className="text-[10px] text-zinc-500 truncate">
                    {profile.email}
                  </p>
                </div>
              )}
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className={cn(
              "w-full justify-start text-xs text-zinc-400 hover:text-red-400 hover:bg-red-500/10 gap-2.5 px-3 py-2 h-9",
              isCollapsed && "justify-center px-0"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span>Sign Out</span>}
          </Button>
        </div>
      </div>
    </div>
  );
}
