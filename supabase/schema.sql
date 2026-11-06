-- Rotation — schéma Supabase
-- À coller une seule fois dans Supabase → SQL Editor → New query → Run.
-- Chaque ligne appartient à un utilisateur (user_id) et la sécurité RLS
-- garantit que personne d'autre ne peut la lire ni la modifier.

create table if not exists public.firms (
  id           text primary key,
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  name         text not null,
  color        text not null default '#3987e5',
  eval_days    int,
  buffer_days  int,
  funded_days  int,
  max_payouts  int,
  price        numeric,
  split        numeric,
  has_buffer   boolean not null default true,
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.plans (
  id           text primary key,
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  firm_id      text not null references public.firms(id) on delete cascade,
  plan         text not null default '',
  size         text not null default '',
  dll          text not null default '',
  consistency  text not null default '',
  label        text not null default '',
  eval_days    int,
  p_eval       numeric,
  p_eval_day   text not null default '',
  p_buffer     numeric,
  p_follow     text not null default '',
  max_payouts  int,
  price_first  numeric,
  price_reset  numeric,
  payouts      text not null default '',
  source       text not null default '',
  created_at   timestamptz not null default now()
);

create table if not exists public.accounts (
  id           text primary key,
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  name         text not null,
  firm_id      text not null references public.firms(id) on delete restrict,
  plan         text not null default '',
  size         text not null default '',
  dll          text not null default '',
  consistency  text not null default '',
  label        text not null default '',
  bought_on    date not null,
  phase        text not null default 'eval' check (phase in ('eval','buffer','followup')),
  cycle        int  not null default 1,
  days         int  not null default 0,
  days_needed  int,
  max_payouts  int,
  status       text not null default 'active' check (status in ('active','dead','completed')),
  end_date     date,
  parent_id    text,
  notes        text not null default '',
  created_at   timestamptz not null default now()
);

create table if not exists public.transactions (
  id           text primary key,
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  date         date not null,
  type         text not null check (type in ('purchase','reset','activation','fee','payout')),
  firm_id      text not null references public.firms(id) on delete restrict,
  account_id   text references public.accounts(id) on delete cascade,
  amount       numeric not null default 0,
  gross        numeric,
  split        numeric,
  note         text not null default '',
  created_at   timestamptz not null default now()
);

create table if not exists public.events (
  id           text primary key,
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  date         date not null,
  ts           bigint not null,
  type         text not null,
  account_id   text references public.accounts(id) on delete cascade,
  firm_id      text,
  phase        text,
  cycle        int,
  day          int,
  amount       numeric,
  tx_id        text,
  note         text not null default ''
);

create table if not exists public.settings (
  user_id      uuid primary key default auth.uid() references auth.users on delete cascade,
  data         jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

create index if not exists accounts_user_idx     on public.accounts(user_id);
create index if not exists transactions_user_idx on public.transactions(user_id, date);
create index if not exists events_user_idx       on public.events(user_id, date);

-- Sécurité : chaque utilisateur ne voit que ses propres lignes
do $$
declare t text;
begin
  foreach t in array array['firms','plans','accounts','transactions','events','settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
