-- =====================================================================
-- SmartScore Task Board — Supabase / PostgreSQL Schema
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------

create type task_status as enum (
  'sierra_bravo',   -- SB - Standby
  'oscar_mike',     -- OM - In Progress
  'india_romeo',    -- IR - In Review
  'tango_charlie',  -- TC - Completed
  'oscar_delta'     -- OD - Recurring daily, does not move
);

create type priority_level as enum ('P1', 'P2', 'P3', 'P4', 'P5');

create type deco_level as enum ('high', 'medium_high', 'medium', 'medium_low', 'low');

create type label_category as enum (
  'revenue',
  'fundraise',
  'customer_delivery',
  'ops',
  'tech',
  'product'
);

-- ---------------------------------------------------------------------
-- Users (mirrors auth.users, holds display profile data)
-- ---------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Weight lookup tables (used by scoring + email-trigger logic)
-- ---------------------------------------------------------------------

create table public.priority_weights (
  priority priority_level primary key,
  label text not null,
  weight numeric(3,2) not null,
  color text not null
);

insert into public.priority_weights (priority, label, weight, color) values
  ('P1', 'Very Important',  0.5, '#EF4444'),
  ('P2', 'Important',       0.4, '#F97316'),
  ('P3', 'Kind Of Important', 0.3, '#EAB308'),
  ('P4', 'Not Important',   0.2, '#86EFAC'),
  ('P5', 'Least Important', 0.1, '#22C55E');

create table public.deco_weights (
  deco deco_level primary key,
  label text not null,
  duration_desc text not null,
  weight numeric(3,2) not null,
  color text not null,
  -- Trigger 3: max days a task can sit in Oscar Mike before nudging
  max_days_in_progress int not null
);

insert into public.deco_weights (deco, label, duration_desc, weight, color, max_days_in_progress) values
  ('low',          'Low',          'Less than 1 Day', 0.1, '#22C55E', 1),
  ('medium_low',   'Medium Low',   '1 to 3 Days',      0.2, '#86EFAC', 3),
  ('medium',       'Medium',       '3 to 5 Days',      0.3, '#EAB308', 5),
  ('medium_high',  'Medium High',  '5 to 7 Days',      0.4, '#F97316', 7),
  ('high',         'High',         'More than 7 Days', 0.5, '#EF4444', 10);

-- ---------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),

  -- Core fields
  name text not null,
  description text not null default '',
  owner_id uuid not null references public.profiles(id),
  due_date date not null,
  priority priority_level not null,
  deco deco_level not null,
  status task_status not null default 'sierra_bravo',

  -- Labels: max 2, enforced via check below
  labels label_category[] not null default '{}',

  -- Blocked badge (separate from status, per PRD)
  is_blocked boolean not null default false,
  blocked_reason text,

  -- Dependency automation linkage (V2)
  -- If this task was auto-created because someone else depends on its owner,
  -- these point back to the originating ("parent") task & requestor.
  parent_task_id uuid references public.tasks(id) on delete set null,
  requested_by uuid references public.profiles(id),
  dependency_reason text,

  -- Scoring (set once, when task reaches tango_charlie)
  score numeric(6,2),
  completed_at timestamptz,

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint labels_max_two check (array_length(labels, 1) is null or array_length(labels, 1) <= 2),
  constraint labels_min_one check (array_length(labels, 1) >= 1)
);

create index idx_tasks_status on public.tasks(status);
create index idx_tasks_owner on public.tasks(owner_id);
create index idx_tasks_due_date on public.tasks(due_date);
create index idx_tasks_parent on public.tasks(parent_task_id);

-- ---------------------------------------------------------------------
-- Contributors (many-to-many, visible to all involved per PRD)
-- ---------------------------------------------------------------------

create table public.task_contributors (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (task_id, user_id)
);

-- ---------------------------------------------------------------------
-- Dependencies ("Depends On" — Task A depends on User B for X)
-- One row per (task, person) the task depends on.
-- linked_task_id points to the auto-created task for that dependency (V2).
-- ---------------------------------------------------------------------

create table public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade, -- Task A
  depends_on_user_id uuid not null references public.profiles(id),     -- User B
  reason text not null,                                                  -- "For -" field
  linked_task_id uuid references public.tasks(id) on delete set null,  -- B's auto-created task
  created_at timestamptz not null default now(),

  unique (task_id, depends_on_user_id)
);

create index idx_deps_task on public.task_dependencies(task_id);
create index idx_deps_user on public.task_dependencies(depends_on_user_id);

-- ---------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index idx_comments_task on public.task_comments(task_id);

-- ---------------------------------------------------------------------
-- Email trigger log (de-dupe / "every 2 hours" cadence enforcement)
-- ---------------------------------------------------------------------

create type email_trigger_type as enum (
  'due_tomorrow',
  'overdue',
  'deco_exceeded',
  'dependency_assigned',
  'review_pending_48h'
);

create table public.email_trigger_log (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id),
  trigger_type email_trigger_type not null,
  sent_at timestamptz not null default now()
);

create index idx_trigger_log_task on public.email_trigger_log(task_id, trigger_type, sent_at desc);

-- ---------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Scoring function (V1 leaderboard formula)
-- Score = Priority Weight x DECO Weight x 100 x Early Completion Bonus
-- Bonus = days(due_date - completed_date), clamped [0, 10]
-- If completed on due date -> bonus = 1. If after due date -> bonus = 0.
-- ---------------------------------------------------------------------

create or replace function public.calculate_task_score(
  p_priority priority_level,
  p_deco deco_level,
  p_due_date date,
  p_completed_date date
) returns numeric language plpgsql as $$
declare
  v_priority_weight numeric;
  v_deco_weight numeric;
  v_days_early int;
  v_bonus numeric;
begin
  select weight into v_priority_weight from public.priority_weights where priority = p_priority;
  select weight into v_deco_weight from public.deco_weights where deco = p_deco;

  v_days_early := p_due_date - p_completed_date;

  if v_days_early > 10 then
    v_bonus := 10;
  elsif v_days_early > 0 then
    v_bonus := v_days_early;
  elsif v_days_early = 0 then
    v_bonus := 1;
  else
    v_bonus := 0;
  end if;

  return round(v_priority_weight * v_deco_weight * 100 * v_bonus, 2);
end;
$$;

-- ---------------------------------------------------------------------
-- Trigger: auto-score a task the moment it lands in Tango Charlie
-- ---------------------------------------------------------------------

create or replace function public.handle_task_completion()
returns trigger language plpgsql as $$
begin
  if new.status = 'tango_charlie' and old.status is distinct from 'tango_charlie' then
    new.completed_at := now();
    new.score := public.calculate_task_score(
      new.priority, new.deco, new.due_date, current_date
    );
  end if;
  return new;
end;
$$;

create trigger trg_task_completion
  before update on public.tasks
  for each row execute function public.handle_task_completion();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.task_contributors enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.task_comments enable row level security;
alter table public.email_trigger_log enable row level security;

-- Internal tool: any authenticated employee can read/write everything.
create policy "authenticated read profiles" on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "authenticated all tasks" on public.tasks
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated all contributors" on public.task_contributors
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated all dependencies" on public.task_dependencies
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated all comments" on public.task_comments
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated all trigger log" on public.email_trigger_log
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------
-- Leaderboard view (Weekly / Monthly / All-Time filtering done in query)
-- ---------------------------------------------------------------------

create view public.leaderboard as
select
  p.id as user_id,
  p.full_name,
  t.id as task_id,
  t.name as task_name,
  t.score,
  t.completed_at
from public.tasks t
join public.profiles p on p.id = t.owner_id
where t.status = 'tango_charlie' and t.score is not null;
