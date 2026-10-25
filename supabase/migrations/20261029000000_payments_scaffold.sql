-- Payments scaffold (DEC-0045): the records for Parity charging its own customers through
-- Stripe, in TEST MODE ONLY. Nothing here moves money. Customers funding real trading is a
-- separate flow that goes through a regulated broker and never touches these tables.
--
-- Four tables, all empty until the feature flag is turned on and a test webhook arrives:
--   payment_customers      one row per person: their Stripe customer id
--   payment_subscriptions  one row per Stripe subscription
--   payment_entitlements   what a person may use (a plan feature), derived from subscriptions
--   payment_events         every Stripe webhook event received, keyed by its event id, so a
--                          retried delivery is recorded once (the idempotency key)
--
-- Access: a signed-in person may read their own rows and nothing else. Nobody but the
-- service role (the webhook, which runs on the server) may insert, update or delete.
-- Signed-out visitors get nothing. Every table refuses live-mode rows with a check, so a
-- live Stripe key cannot write here until a later migration removes that check on purpose.
-- Additive only: new tables, nothing else changes.

create table if not exists public.payment_customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text not null unique check (stripe_customer_id ~ '^cus_[A-Za-z0-9_]{1,250}$'),
  livemode boolean not null default false check (livemode = false),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_subscription_id text not null unique check (stripe_subscription_id ~ '^sub_[A-Za-z0-9_]{1,250}$'),
  stripe_customer_id text not null check (stripe_customer_id ~ '^cus_[A-Za-z0-9_]{1,250}$'),
  plan text not null check (plan in ('pro', 'seller', 'api_starter', 'platform')),
  status text not null check (status in ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  livemode boolean not null default false check (livemode = false),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_subscriptions_user on public.payment_subscriptions (user_id);

create table if not exists public.payment_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null check (feature ~ '^[a-z][a-z0-9_]{1,63}$'),
  subscription_id uuid references public.payment_subscriptions (id) on delete cascade,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  constraint payment_entitlements_one unique (user_id, feature)
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  -- Stripe's event id. Unique, so a redelivered event is stored once and handled once.
  stripe_event_id text not null unique check (stripe_event_id ~ '^evt_[A-Za-z0-9_]{1,250}$'),
  type text not null check (char_length(type) between 1 and 120),
  livemode boolean not null default false check (livemode = false),
  -- Only the id of the object the event is about (a subscription or a checkout session),
  -- never the full payload: no card data, no addresses, nothing we do not need.
  object_id text check (char_length(object_id) <= 255),
  user_id uuid references auth.users (id) on delete set null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text check (char_length(error) <= 500)
);

create index if not exists payment_events_user on public.payment_events (user_id);

alter table public.payment_customers enable row level security;
alter table public.payment_subscriptions enable row level security;
alter table public.payment_entitlements enable row level security;
alter table public.payment_events enable row level security;

-- Read only for signed-in people, nothing for signed-out visitors. Supabase grants every
-- privilege by default and row level security does not stop TRUNCATE, so remove them all
-- and grant back SELECT alone (the same shape as 20261020020000_tighten_grants.sql).
revoke all on public.payment_customers, public.payment_subscriptions, public.payment_entitlements, public.payment_events from anon, authenticated;
grant select on public.payment_customers, public.payment_subscriptions, public.payment_entitlements, public.payment_events to authenticated;
grant select, insert, update, delete on public.payment_customers, public.payment_subscriptions, public.payment_entitlements, public.payment_events to service_role;

drop policy if exists "read own payment customer" on public.payment_customers;
create policy "read own payment customer" on public.payment_customers
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "read own subscriptions" on public.payment_subscriptions;
create policy "read own subscriptions" on public.payment_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "read own entitlements" on public.payment_entitlements;
create policy "read own entitlements" on public.payment_entitlements
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "read own payment events" on public.payment_events;
create policy "read own payment events" on public.payment_events
  for select to authenticated
  using (user_id = (select auth.uid()));
