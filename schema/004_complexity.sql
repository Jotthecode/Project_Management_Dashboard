-- =====================================================================
-- SCC (SmartScore Command Center) — Complexity & Notes Updates (004)
-- =====================================================================

-- 1. Remove label limit constraints
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS labels_max_two;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS labels_min_one;

-- 2. Add complexity column (uses existing deco_level type)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS complexity deco_level NOT NULL DEFAULT 'medium';

-- 3. Add wingmen_ids column for unlimited owners
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS wingmen_ids uuid[] NOT NULL DEFAULT '{}';

-- 4. Create task_notes table for multi-note system
CREATE TABLE IF NOT EXISTS public.task_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast sorting/retrieval
CREATE INDEX IF NOT EXISTS idx_task_notes_lookup ON public.task_notes(task_id, created_at DESC);

-- Enable RLS on task_notes
ALTER TABLE public.task_notes ENABLE ROW LEVEL SECURITY;

-- Policy to allow CRUD operations for authenticated employees
CREATE POLICY "authenticated all task_notes" 
  ON public.task_notes
  FOR ALL USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');

-- 5. Update scoring function to incorporate separate Duration and Complexity weights
CREATE OR REPLACE FUNCTION public.calculate_task_score(
  p_priority priority_level,
  p_deco deco_level,       -- Duration
  p_complexity deco_level, -- Complexity
  p_due_date date,
  p_completed_date date
) RETURNS numeric LANGUAGE plpgsql AS $$
DECLARE
  v_priority_weight numeric;
  v_deco_weight numeric;
  v_complexity_weight numeric;
  v_days_early int;
  v_bonus numeric;
BEGIN
  SELECT weight INTO v_priority_weight FROM public.priority_weights WHERE priority = p_priority;
  SELECT weight INTO v_deco_weight FROM public.deco_weights WHERE deco = p_deco;
  SELECT weight INTO v_complexity_weight FROM public.deco_weights WHERE deco = p_complexity;

  v_days_early := p_due_date - p_completed_date;

  IF v_days_early > 10 THEN
    v_bonus := 10;
  ELIF v_days_early > 0 THEN
    v_bonus := v_days_early;
  ELIF v_days_early = 0 THEN
    v_bonus := 1;
  ELSE
    v_bonus := 0;
  END IF;

  RETURN round(v_priority_weight * v_deco_weight * v_complexity_weight * 100 * v_bonus, 2);
END;
$$;

-- 6. Update task completion scoring trigger to pass new complexity value
CREATE OR REPLACE FUNCTION public.handle_task_completion()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF new.status = 'tango_charlie' AND old.status IS DISTINCT FROM 'tango_charlie' THEN
    IF new.completed_at IS NULL THEN
      new.completed_at := now();
    END IF;
    IF new.score IS NULL THEN
      new.score := public.calculate_task_score(
        new.priority, new.deco, new.complexity, new.due_date, new.completed_at::date
      );
    END IF;
  END IF;
  RETURN new;
END;
$$;
