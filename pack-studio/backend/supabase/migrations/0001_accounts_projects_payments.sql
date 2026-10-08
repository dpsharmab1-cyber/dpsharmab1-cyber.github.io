-- Pack Studio: accounts, saved projects and payments.
-- Run once in the Supabase SQL editor (or `supabase db push`).
--
-- Security model
--   * Row level security on every table: people only ever see their own rows.
--   * A person's plan lives in `profiles` and has no update policy, so the browser
--     cannot change it. Only the payment functions (service role) can, through
--     `mark_paid`, after Razorpay's signature has been verified.

-- ---------- profiles ----------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  plan        text not null default 'free' check (plan in ('free', 'pro', 'business')),
  plan_until  timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);

-- every new sign-up gets a profile row
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- the plan someone actually has right now (a lapsed plan counts as free)
create function public.effective_plan(uid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select case when p.plan <> 'free' and p.plan_until > now() then p.plan else 'free' end
       from public.profiles p where p.id = uid),
    'free');
$$;

-- ---------- projects ----------

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null default 'Untitled pack' check (char_length(name) between 1 and 120),
  template    text not null check (char_length(template) <= 40),
  state       jsonb not null,
  thumb       text check (thumb is null or char_length(thumb) < 200000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint projects_state_size check (pg_column_size(state) < 8000000)
);

create index projects_user_updated on public.projects (user_id, updated_at desc);

alter table public.projects enable row level security;

create policy "projects: read own"   on public.projects for select using (auth.uid() = user_id);
create policy "projects: insert own" on public.projects for insert with check (auth.uid() = user_id);
create policy "projects: update own" on public.projects for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "projects: delete own" on public.projects for delete using (auth.uid() = user_id);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger projects_touch before update on public.projects
  for each row execute procedure public.touch_updated_at();

-- Free accounts keep up to 10 projects in the cloud (keep in sync with assets/config.js).
create function public.enforce_free_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.effective_plan(new.user_id) = 'free'
     and (select count(*) from public.projects where user_id = new.user_id) >= 10 then
    raise exception 'free_limit' using hint = 'Upgrade to save more projects';
  end if;
  return new;
end $$;

create trigger projects_free_limit before insert on public.projects
  for each row execute procedure public.enforce_free_limit();

-- ---------- payments ----------

create table public.payments (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  plan                  text not null check (plan in ('pro_month', 'pro_year', 'business_month')),
  amount                integer not null check (amount > 0),   -- paise
  currency              text not null default 'INR',
  razorpay_order_id     text not null unique,
  razorpay_payment_id   text,
  status                text not null default 'created' check (status in ('created', 'paid')),
  created_at            timestamptz not null default now(),
  paid_at               timestamptz
);

create index payments_user on public.payments (user_id, created_at desc);

alter table public.payments enable row level security;

create policy "payments: read own" on public.payments for select using (auth.uid() = user_id);

-- Marks an order paid and extends the buyer's plan. Idempotent: the browser
-- callback and the webhook can both call it; only the first one changes anything.
-- Returns the updated profile as JSON, or null when the order was already paid
-- or does not exist.
create function public.mark_paid(p_order_id text, p_payment_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user  uuid;
  v_plan  text;
  v_tier  text;
  v_days  int;
  v_base  timestamptz;
  v_out   jsonb;
begin
  update public.payments
     set status = 'paid', razorpay_payment_id = p_payment_id, paid_at = now()
   where razorpay_order_id = p_order_id and status <> 'paid'
   returning user_id, plan into v_user, v_plan;

  if v_user is null then
    return null;
  end if;

  v_tier := split_part(v_plan, '_', 1);                       -- pro | business
  v_days := case when v_plan like '%\_year' then 366 else 31 end;

  -- renewing the same tier early adds on top of the time left
  select case when p.plan = v_tier and p.plan_until > now() then p.plan_until else now() end
    into v_base
    from public.profiles p where p.id = v_user;

  update public.profiles
     set plan = v_tier, plan_until = coalesce(v_base, now()) + make_interval(days => v_days)
   where id = v_user
   returning jsonb_build_object('user_id', id, 'plan', plan, 'plan_until', plan_until) into v_out;

  return v_out;
end $$;

revoke execute on function public.mark_paid(text, text) from public, anon, authenticated;
revoke execute on function public.enforce_free_limit() from public, anon, authenticated;
revoke execute on function public.effective_plan(uuid) from public, anon, authenticated;
