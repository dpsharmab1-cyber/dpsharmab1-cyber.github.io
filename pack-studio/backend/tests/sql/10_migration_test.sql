-- Behaviour tests for 0001_accounts_projects_payments.sql (see README in this folder).
\set ON_ERROR_STOP on
\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'

insert into auth.users (id, email) values (:'A', 'a@example.com'), (:'B', 'b@example.com');
do $$ begin assert (select count(*) from public.profiles) = 2, 'sign-up creates a profile'; end $$;

-- ---- as user A ----
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
insert into public.projects (name, template, state) values ('A first', 'rte', '{"v":1}');
update public.profiles set plan = 'pro', plan_until = now() + interval '1 year';
do $$ begin assert (select plan from public.profiles) = 'free', 'users cannot give themselves a plan'; end $$;
do $$ begin
  begin
    perform public.mark_paid('x', 'y');
    assert false, 'mark_paid must not be callable by users';
  exception when insufficient_privilege then null;
  end;
end $$;
do $$ begin
  begin
    insert into public.projects (user_id, name, template, state) values ('22222222-2222-2222-2222-222222222222', 'sneaky', 'rte', '{}');
    assert false, 'cannot create projects for someone else';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---- as user B ----
select set_config('request.jwt.claim.sub', :'B', false);
insert into public.projects (name, template, state) values ('B first', 'mailer', '{}');
do $$ begin assert (select count(*) from public.projects) = 1, 'B sees only B''s projects'; end $$;
update public.projects set name = 'hijack' where name = 'A first';
delete from public.projects where name = 'A first';

-- ---- back to A: free limit of 10 ----
select set_config('request.jwt.claim.sub', :'A', false);
do $$ begin assert (select name from public.projects) = 'A first', 'B could not touch A''s project'; end $$;
insert into public.projects (template, state) select 'rte', '{}' from generate_series(1, 9);
do $$ begin
  begin
    insert into public.projects (template, state) values ('rte', '{}');
    assert false, 'free accounts stop at 10 projects';
  exception when raise_exception then
    assert sqlerrm = 'free_limit', 'error is free_limit';
  end;
end $$;
reset role;

-- ---- payments (service role / functions) ----
insert into public.payments (user_id, plan, amount, razorpay_order_id) values (:'A', 'pro_month', 39900, 'order_A1');
do $$ declare r jsonb; begin
  r := public.mark_paid('order_A1', 'pay_A1');
  assert r->>'plan' = 'pro', 'paid order grants pro';
  assert (r->>'plan_until')::timestamptz between now() + interval '30 days' and now() + interval '32 days', 'one month';
  assert public.mark_paid('order_A1', 'pay_A1') is null, 'second call is a no-op';
  assert public.mark_paid('order_missing', 'p') is null, 'unknown order is a no-op';
end $$;

insert into public.payments (user_id, plan, amount, razorpay_order_id) values (:'A', 'pro_month', 39900, 'order_A2');
do $$ declare r jsonb; begin
  r := public.mark_paid('order_A2', 'pay_A2');
  assert (r->>'plan_until')::timestamptz between now() + interval '61 days' and now() + interval '63 days', 'early renewal adds on top';
end $$;

insert into public.payments (user_id, plan, amount, razorpay_order_id) values (:'B', 'pro_year', 399000, 'order_B1');
do $$ declare r jsonb; begin
  r := public.mark_paid('order_B1', 'pay_B1');
  assert (r->>'plan_until')::timestamptz between now() + interval '365 days' and now() + interval '367 days', 'yearly plan';
end $$;

-- pro can save beyond 10
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
insert into public.projects (template, state) values ('rte', '{}');
do $$ begin assert (select count(*) from public.projects) = 11, 'pro saves past the free limit'; end $$;
do $$ begin assert (select status from public.payments where razorpay_order_id = 'order_A1') = 'paid', 'user can read own payments'; end $$;
do $$ begin assert (select count(*) from public.payments) = 2, 'user sees only own payments'; end $$;
reset role;

-- a lapsed plan counts as free again
update public.profiles set plan_until = now() - interval '1 day' where id = :'A';
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
do $$ begin
  begin
    insert into public.projects (template, state) values ('rte', '{}');
    assert false, 'lapsed plan is limited again';
  exception when raise_exception then null;
  end;
end $$;
reset role;

\echo 'ALL SQL TESTS PASSED'
