-- =========================================================
-- انصحني (Ansahni) — Schéma de base de données (version finale)
-- Supabase = PostgreSQL + Auth intégrée (email/password)
-- =========================================================

-- ---------------------------------------------------------
-- 1. Profils utilisateurs
-- ---------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  points int default 0,              -- نقاط المكافأة (5 لكل يوم مكتمل)
  auto_speak boolean default true,   -- تفعيل نطق ردود أنيس تلقائيًا
  onboarded boolean default false,   -- هل شاهد شاشات التعريف بالتطبيق
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------
-- 2. Planning quotidien + note du jour (score /100 généré par l'IA)
-- ---------------------------------------------------------
create table public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  plan_date date not null,
  morning_adhkar_done boolean default false,
  tasks jsonb default '[]',                 -- [{title, done}]
  lunch_activity_done boolean default false,
  lunch_activity_type text,
  evening_adhkar_done boolean default false,
  breathing_exercise_done boolean default false,
  day_rating int check (day_rating between 0 and 5),
  day_review_notes text,
  day_score int check (day_score between 0 and 100),   -- النقطة المحسوبة في نهاية اليوم
  day_note text,                                        -- ملاحظة أنيس الشخصية عن اليوم
  main_emotion text,                                     -- الشعور الأساسي في جلسة TCC لهذا اليوم (للمقارنة عبر الأيام)
  points_awarded boolean default false,                 -- لمنع احتساب الـ5 نقاط مرتين
  created_at timestamptz default now(),
  unique(user_id, plan_date)
);

-- ---------------------------------------------------------
-- 3. Séances TCC (تقييم الأفكار التلقائية) — parcours en 5 étapes
-- ---------------------------------------------------------
create table public.cbt_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  daily_plan_id uuid references public.daily_plans(id) on delete set null,

  automatic_thought text,
  belief_before int check (belief_before between 0 and 100),
  emotion text,
  emotion_intensity int check (emotion_intensity between 0 and 100),
  evidence_for text,
  evidence_against text,
  helps_now boolean,
  harms_now boolean,
  thinking_errors text[],
  new_thought_user text,
  new_thought_ai text,
  belief_after int check (belief_after between 0 and 100),
  belief_old_after int check (belief_old_after between 0 and 100),

  ai_summary text,
  ai_encouragement text,
  ai_acceptance_note text,
  ai_professional_referral boolean default false,
  ai_referral_reason text,

  status text default 'in_progress',
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- ---------------------------------------------------------
-- 4. Contenu de référence (adhkar, rappels, défis)
-- ---------------------------------------------------------
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  type text not null,   -- morning_adhkar | evening_adhkar | reminder | challenge
  text_ar text not null,
  order_index int default 0
);

-- ---------------------------------------------------------
-- 5. Planning mensuel (أهداف الشهر + تقييم نهاية الشهر)
-- ---------------------------------------------------------
create table public.monthly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  month_key text not null,   -- format 'YYYY-MM'
  goals jsonb default '[]',  -- [{category, text, rating}]
  review_comment text,
  ai_review text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, month_key)
);

-- ---------------------------------------------------------
-- Row Level Security : chacun ne voit que ses données
-- ---------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.daily_plans enable row level security;
alter table public.cbt_sessions enable row level security;
alter table public.monthly_plans enable row level security;

create policy "profiles_self" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "daily_plans_self" on public.daily_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "cbt_sessions_self" on public.cbt_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "monthly_plans_self" on public.monthly_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.content_items enable row level security;
create policy "content_read_all" on public.content_items
  for select using (true);

-- ---------------------------------------------------------
-- Trigger : créer un profil automatiquement à l'inscription
-- ---------------------------------------------------------
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
