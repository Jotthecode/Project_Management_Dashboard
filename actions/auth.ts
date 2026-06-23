// actions/auth.ts
"use server";

import { createClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function signInAction(email: string, password: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    return { error: error.message };
  }
  return { success: true };
}

export async function signUpAction(email: string, password: string, fullName: string) {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Automatically confirm the email to bypass verification loops
    });
    
    if (error) {
      return { error: error.message };
    }
    
    if (data.user) {
      // Insert into public.profiles using supabaseAdmin to bypass RLS
      const { error: profileError } = await admin
        .from("profiles")
        .insert({
          id: data.user.id,
          full_name: fullName,
          email: email,
        });
        
      if (profileError) {
        console.error("Error creating profile:", profileError);
        return { error: `User created, but profile could not be created: ${profileError.message}` };
      }
    }

    return { success: true };
  } catch (err: any) {
    return { error: err.message || "An unexpected error occurred during signup." };
  }
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
