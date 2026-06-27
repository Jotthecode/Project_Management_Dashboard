// actions/profiles.ts
"use server";

import { createClient } from "@/lib/supabase-server";
import type { Profile } from "@/lib/types";

import { revalidatePath } from "next/cache";

export async function getProfiles() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .order("full_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function updateProfile(fullName: string) {
  if (!fullName.trim()) throw new Error("Full name is required.");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: fullName.trim() })
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/", "layout");
  return data as Profile;
}