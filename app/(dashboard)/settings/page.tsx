// app/(dashboard)/settings/page.tsx
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="h-screen w-full overflow-y-auto flex flex-col p-6 space-y-6" style={{ backgroundColor: "#1E1E1E" }}>
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-400">Configure your personal preferences and system notifications</p>
      </div>
      <div className="rounded-xl border border-zinc-800 p-8 text-center text-zinc-500" style={{ backgroundColor: "#2D2D2D" }}>
        Settings panel and account configuration tools are coming soon.
      </div>
    </main>
  );
}
