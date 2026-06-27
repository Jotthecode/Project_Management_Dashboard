// app/(dashboard)/archive/page.tsx
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { getArchivedTasks } from "@/actions/tasks";
import { ArchiveClient } from "./archive-client";

export default async function ArchivePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const archivedTasks = await getArchivedTasks();

  return <ArchiveClient initialTasks={archivedTasks} />;
}
