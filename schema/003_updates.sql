-- =====================================================================
-- SCC (SmartScore Command Center) — DB Updates (003)
-- =====================================================================

-- 1. Add secondary owner to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS owner2_id uuid;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_owner2_id_fkey;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_owner2_id_fkey FOREIGN KEY (owner2_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Add 'blocking_task' to label_category enum
-- PostgreSQL doesn't allow ALTER TYPE ... ADD VALUE inside transaction blocks in some cases, 
-- but it's safe to run. We use a helper block to prevent duplicate value errors.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t 
                 JOIN pg_enum e ON t.oid = e.enumtypid 
                 WHERE t.typname = 'label_category' AND e.enumlabel = 'blocking_task') THEN
    ALTER TYPE public.label_category ADD VALUE 'blocking_task';
  END IF;
END
$$;

-- 3. Update deco_weights table labels & weights
-- Introduce weighted levels: Very High (0.5), High (0.4), Medium (0.3), Low (0.2), Very Low (0.1)
UPDATE public.deco_weights SET label = 'Very Low', weight = 0.1 WHERE deco = 'low';
UPDATE public.deco_weights SET label = 'Low', weight = 0.2 WHERE deco = 'medium_low';
UPDATE public.deco_weights SET label = 'Medium', weight = 0.3 WHERE deco = 'medium';
UPDATE public.deco_weights SET label = 'High', weight = 0.4 WHERE deco = 'medium_high';
UPDATE public.deco_weights SET label = 'Very High', weight = 0.5 WHERE deco = 'high';

-- 4. Update task completion scoring trigger to prevent timezone-related 0 score errors
-- Respect client-provided score if set; otherwise usecompleted_at::date
CREATE OR REPLACE FUNCTION public.handle_task_completion()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF new.status = 'tango_charlie' AND old.status IS DISTINCT FROM 'tango_charlie' THEN
    IF new.completed_at IS NULL THEN
      new.completed_at := now();
    END IF;
    IF new.score IS NULL THEN
      new.score := public.calculate_task_score(
        new.priority, new.deco, new.due_date, new.completed_at::date
      );
    END IF;
  END IF;
  RETURN new;
END;
$$;

-- 5. Create daily_notes table for Daily Tasks
CREATE TABLE IF NOT EXISTS public.daily_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note_date date NOT NULL DEFAULT current_date,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_notes_unique_task_author_date UNIQUE (task_id, author_id, note_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_notes_search ON public.daily_notes(task_id, note_date);

-- Enable Row Level Security (RLS) on daily_notes
ALTER TABLE public.daily_notes ENABLE ROW LEVEL SECURITY;

-- Policy to allow all authenticated employees to perform CRUD operations
CREATE POLICY "authenticated all daily_notes" 
  ON public.daily_notes
  FOR ALL USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');
