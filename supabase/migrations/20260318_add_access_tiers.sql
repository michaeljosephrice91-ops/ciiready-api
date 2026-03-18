alter table public.purchases
  add column if not exists access_tier text;

alter table public.purchases
  add column if not exists modules_access jsonb;

update public.purchases
set
  access_tier = 'full-access',
  modules_access = '["r01","r02","r03","r04","r05"]'::jsonb
where coalesce(access_tier, '') = '';

alter table public.purchases
  alter column access_tier set default 'full-access';

update public.purchases
set modules_access = case
  when access_tier = 'r01-only' then '["r01"]'::jsonb
  else '["r01","r02","r03","r04","r05"]'::jsonb
end
where modules_access is null;

create index if not exists purchases_access_tier_idx on public.purchases (access_tier);
