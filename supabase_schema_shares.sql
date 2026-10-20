-- =====================================================================
-- Vetly — روابط المشاركة (قراءة فقط) | شغّل الملف ده مرة واحدة:
-- Supabase → SQL Editor → New query → الصق كله هنا → Run
-- (ملف إضافي بعد supabase_schema.sql — مش بديل عنه)
-- =====================================================================

-- اللينك نفسه هو التصريح: أي حد معاه الـ id يقدر يقرا — من غير تسجيل دخول.
-- المالك بس هو اللي يقدر ينشئ أو يحذف روابط.
-- اللينك LIVE: التطبيق بيحدّث محتوى كل روابط المشروع تلقائيًا بعد كل حفظ،
-- فالزائر بيشوف دايمًا آخر نسخة من غير ما المالك يعمل لينك جديد.
-- scope: 'project' = المشروع كله | 'story' = يوزر ستوري واحدة | 'feature' = فيتشر جوه ستوري
create table if not exists public.public_shares (
    id uuid primary key default gen_random_uuid(),
    owner uuid not null references auth.users(id) on delete cascade,
    project_id uuid references public.projects(id) on delete cascade,
    project_name text,
    scope text not null check (scope in ('project', 'story', 'feature')),
    story_id text,
    story_name text,
    feature text,
    feature_label text,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

alter table public.public_shares enable row level security;

-- القراءة عامة: اللينك بيشتغل من أي جهاز ومن غير حساب
drop policy if exists "shares_public_read" on public.public_shares;
create policy "shares_public_read" on public.public_shares
    for select using (true);

-- الإنشاء والحذف والتحديث للمالك بس (التحديث = تجديد محتوى اللينك مع كل حفظ)
drop policy if exists "shares_owner_insert" on public.public_shares;
create policy "shares_owner_insert" on public.public_shares
    for insert with check (auth.uid() = owner);

drop policy if exists "shares_owner_update" on public.public_shares;
create policy "shares_owner_update" on public.public_shares
    for update using (auth.uid() = owner) with check (auth.uid() = owner);

drop policy if exists "shares_owner_delete" on public.public_shares;
create policy "shares_owner_delete" on public.public_shares
    for delete using (auth.uid() = owner);
