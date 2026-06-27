import { getBoardTasks } from "@/actions/tasks";
import { getProfiles } from "@/actions/profiles";
import { KanbanBoard } from "@/components/kanban-board";
import { CreateTaskSheet } from "@/components/create-task-sheet";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [tasks, profiles] = await Promise.all([getBoardTasks(), getProfiles()]);

  return (
    <main className="h-screen w-full flex flex-col bg-background text-foreground">
      <header className="px-4 py-3 border-b border-zinc-250 dark:border-zinc-800 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">SCC (SmartScore Command Center 📡)</h1>
        <CreateTaskSheet profiles={profiles} />
      </header>
      <div className="flex-1 min-h-0">
        <KanbanBoard initialTasks={tasks} profiles={profiles} currentUserId={user?.id} />
      </div>
    </main>
  );
}
