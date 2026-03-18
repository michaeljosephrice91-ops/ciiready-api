create table if not exists public.demo_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamp with time zone not null default now(),
  started_demo boolean not null default true,
  completed_demo boolean not null default false,
  converted boolean not null default false
);

create unique index if not exists demo_leads_email_idx on public.demo_leads (email);

alter table public.demo_leads enable row level security;

grant insert, update on public.demo_leads to anon, authenticated;
revoke select on public.demo_leads from anon, authenticated;

drop policy if exists demo_leads_insert on public.demo_leads;
create policy demo_leads_insert
on public.demo_leads
for insert
to anon, authenticated
with check (email <> '');

drop policy if exists demo_leads_update on public.demo_leads;
create policy demo_leads_update
on public.demo_leads
for update
to anon, authenticated
using (true)
with check (email <> '');
