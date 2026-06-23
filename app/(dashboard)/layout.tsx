// app/(dashboard)/layout.tsx
import { createClient } from "@/lib/supabase-server";
import { Sidebar } from "@/components/sidebar";
import { AITaskAgent } from "@/components/ai-task-agent";
import { getProfiles } from "@/actions/profiles";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the profile of the logged-in user and all system profiles
  const [profileResult, profiles] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    getProfiles(),
  ]);

  const profile = profileResult.data;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#1E1E1E]">
      <Sidebar profile={profile} />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {children}
      </div>
      <AITaskAgent profiles={profiles} />
    </div>
  );
}
