-- =====================================================================
-- SmartScore Task Board — Supabase / PostgreSQL Schema Migration (002)
-- =====================================================================

-- Daily task completion tracking
CREATE TABLE IF NOT EXISTS public.daily_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  completed_by uuid NOT NULL REFERENCES public.profiles(id),
  completed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_completions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated employees to read/write daily completions
CREATE POLICY "authenticated all daily_completions" 
  ON public.daily_completions
  FOR ALL USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');

-- =====================================================================
-- RLS Policies for Anon / Cron Notifications and Profiles
-- =====================================================================

-- Allow anon select on profiles for server-side route logic
CREATE POLICY "anon select profiles" 
  ON public.profiles 
  FOR SELECT USING (true);

-- Allow anon select on tasks for cron job routes to read tasks
CREATE POLICY "anon select tasks" 
  ON public.tasks 
  FOR SELECT USING (true);

-- Allow anon select on priority/deco weights for score computations
CREATE POLICY "anon select priority_weights" 
  ON public.priority_weights 
  FOR SELECT USING (true);

CREATE POLICY "anon select deco_weights" 
  ON public.deco_weights 
  FOR SELECT USING (true);

-- Allow anon select/insert on trigger log for background logging
CREATE POLICY "anon all trigger log" 
  ON public.email_trigger_log 
  FOR ALL USING (true) 
  WITH CHECK (true);

-- Allow profile creation on signup (auth.users creates, anon client inserts profile)
CREATE POLICY "Allow anon insert profiles" 
  ON public.profiles 
  FOR INSERT WITH CHECK (true);
