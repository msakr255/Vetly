-- =====================================================================
-- Vetly cloud storage — شغّل الملف ده مرة واحدة:
-- Supabase → SQL Editor → New query → الصق كله هنا → Run
-- =====================================================================

-- المشاريع: كل يوزر له مشاريعه، وحذف اليوزر يمسح مشاريعه
create table if not exists public.projects (
    id uuid primary key default gen_random_uuid(),
    owner uuid not null references auth.users(id) on delete cascade,
    name text not null,
    created_at timestamptz not null default now()
);

-- بيانات كل مشروع (كل شغل التطبيق كـ snapshot في jsonb)
-- project_id هو primary key ⇒ snapshot واحد لكل مشروع (upsert)
-- حذف المشروع يمسح الـ snapshot تلقائيًا (on delete cascade)
create table if not exists public.project_snapshots (
    project_id uuid primary key references public.projects(id) on delete cascade,
    owner uuid not null references auth.users(id) on delete cascade,
    payload jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

-- أمان على مستوى الصف: كل يوزر يشوف/يعدّل/يحذف مشاريعه هو بس
alter table public.projects enable row level security;
alter table public.project_snapshots enable row level security;

drop policy if exists "projects_owner_all" on public.projects;
create policy "projects_owner_all" on public.projects
    for all using (auth.uid() = owner) with check (auth.uid() = owner);

drop policy if exists "snapshots_owner_all" on public.project_snapshots;
create policy "snapshots_owner_all" on public.project_snapshots
    for all using (auth.uid() = owner) with check (auth.uid() = owner);
