// actions/profiles.ts
"use server";

import { createClient } from "@/lib/supabase-server";
import type { Profile } from "@/lib/types";

export async function getProfiles() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .order("full_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Profile[];
}