-- ============================================================
-- CRYPTO COM EXCHANGE
-- SETTINGS / PROFILE / SAVED WITHDRAWAL DESTINATIONS
-- Migration: 20260929_settings.sql
-- ============================================================

begin;

-- ============================================================
-- 1. PROFILE EXTENSIONS
-- ============================================================

alter table public.profiles
  add column if not exists avatar_url text;

alter table public.profiles
  add column if not exists email_notifications_enabled boolean
    not null default true;

alter table public.profiles
  add column if not exists security_alerts_enabled boolean
    not null default true;

alter table public.profiles
  add column if not exists preferred_currency text
    not null default 'USD';

alter table public.profiles
  add column if not exists timezone text
    not null default 'UTC';

alter table public.profiles
  add column if not exists updated_at timestamptz
    not null default now();

-- ============================================================
-- 2. PROFILE UPDATED_AT TRIGGER
-- ============================================================

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at
on public.profiles;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

-- ============================================================
-- 3. ADMIN-CONTROLLED WITHDRAWAL DESTINATIONS
--
-- These are the assets/networks that administrators make
-- available for users to save as withdrawal destinations.
--
-- Example:
-- BTC / Bitcoin
-- ETH / Ethereum
-- USDT / TRC20
-- USDT / ERC20
-- USDT / BEP20
-- etc.
-- ============================================================

create table if not exists public.withdrawal_wallet_options (
  id uuid primary key default gen_random_uuid(),

  asset_code text not null,
  asset_name text not null,

  network_code text not null,
  network_name text not null,

  address_label text,

  is_enabled boolean not null default true,

  display_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint withdrawal_wallet_options_asset_check
    check (length(trim(asset_code)) > 0),

  constraint withdrawal_wallet_options_asset_name_check
    check (length(trim(asset_name)) > 0),

  constraint withdrawal_wallet_options_network_check
    check (length(trim(network_code)) > 0),

  constraint withdrawal_wallet_options_network_name_check
    check (length(trim(network_name)) > 0),

  constraint withdrawal_wallet_options_unique_network
    unique (asset_code, network_code)
);

create index if not exists idx_withdrawal_wallet_options_enabled
on public.withdrawal_wallet_options(is_enabled, display_order);

create index if not exists idx_withdrawal_wallet_options_asset
on public.withdrawal_wallet_options(asset_code);

-- ============================================================
-- 4. UPDATED_AT FOR WITHDRAWAL OPTIONS
-- ============================================================

create or replace function public.set_withdrawal_wallet_options_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists withdrawal_wallet_options_set_updated_at
on public.withdrawal_wallet_options;

create trigger withdrawal_wallet_options_set_updated_at
before update on public.withdrawal_wallet_options
for each row
execute function public.set_withdrawal_wallet_options_updated_at();

-- ============================================================
-- 5. USER SAVED WITHDRAWAL ADDRESSES
--
-- IMPORTANT:
-- This does not replace the existing wallet_addresses table.
--
-- If wallet_addresses already exists in the project, the Settings
-- page can continue using that table.
--
-- This table gives us a clean, dedicated structure for the new
-- Settings functionality.
-- ============================================================

create table if not exists public.saved_withdrawal_addresses (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  wallet_option_id uuid not null
    references public.withdrawal_wallet_options(id)
    on delete restrict,

  label text,

  wallet_address text not null,

  is_preferred boolean not null default false,

  is_verified boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint saved_withdrawal_addresses_address_check
    check (length(trim(wallet_address)) > 0),

  constraint saved_withdrawal_addresses_label_check
    check (
      label is null
      or length(trim(label)) <= 100
    )
);

create index if not exists idx_saved_withdrawal_addresses_user
on public.saved_withdrawal_addresses(user_id);

create index if not exists idx_saved_withdrawal_addresses_option
on public.saved_withdrawal_addresses(wallet_option_id);

create index if not exists idx_saved_withdrawal_addresses_preferred
on public.saved_withdrawal_addresses(user_id, is_preferred);

-- ============================================================
-- 6. ONLY ONE PREFERRED ADDRESS PER WALLET OPTION / USER
-- ============================================================

create unique index if not exists
idx_saved_withdrawal_addresses_one_preferred
on public.saved_withdrawal_addresses(
  user_id,
  wallet_option_id
)
where is_preferred = true;

-- ============================================================
-- 7. UPDATED_AT FOR SAVED ADDRESSES
-- ============================================================

create or replace function public.set_saved_withdrawal_addresses_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists saved_withdrawal_addresses_set_updated_at
on public.saved_withdrawal_addresses;

create trigger saved_withdrawal_addresses_set_updated_at
before update on public.saved_withdrawal_addresses
for each row
execute function public.set_saved_withdrawal_addresses_updated_at();

-- ============================================================
-- 8. AUTOMATICALLY CLEAR ANOTHER PREFERRED ADDRESS
--
-- If a user chooses a new preferred address for the same wallet
-- option, the old preferred address is automatically cleared.
-- ============================================================

create or replace function public.handle_preferred_withdrawal_address()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin

  if new.is_preferred = true then

    update public.saved_withdrawal_addresses
    set
      is_preferred = false,
      updated_at = now()
    where user_id = new.user_id
      and wallet_option_id = new.wallet_option_id
      and id <> new.id
      and is_preferred = true;

  end if;

  return new;

end;
$$;

drop trigger if exists saved_withdrawal_addresses_preferred_trigger
on public.saved_withdrawal_addresses;

create trigger saved_withdrawal_addresses_preferred_trigger
before insert or update of is_preferred, user_id, wallet_option_id
on public.saved_withdrawal_addresses
for each row
execute function public.handle_preferred_withdrawal_address();

-- ============================================================
-- 9. RLS — WITHDRAWAL WALLET OPTIONS
--
-- Everyone authenticated can see enabled options.
-- Only admins should be able to create/edit/disable options.
-- ============================================================

alter table public.withdrawal_wallet_options enable row level security;

drop policy if exists
"Authenticated users can view enabled withdrawal wallet options"
on public.withdrawal_wallet_options;

create policy
"Authenticated users can view enabled withdrawal wallet options"
on public.withdrawal_wallet_options
for select
to authenticated
using (is_enabled = true);

-- ============================================================
-- 10. RLS — SAVED WITHDRAWAL ADDRESSES
--
-- Users can only see their own saved addresses.
-- Users can insert/update/delete their own addresses.
-- ============================================================

alter table public.saved_withdrawal_addresses enable row level security;

drop policy if exists
"Users can view their own saved withdrawal addresses"
on public.saved_withdrawal_addresses;

create policy
"Users can view their own saved withdrawal addresses"
on public.saved_withdrawal_addresses
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists
"Users can create their own saved withdrawal addresses"
on public.saved_withdrawal_addresses;

create policy
"Users can create their own saved withdrawal addresses"
on public.saved_withdrawal_addresses
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists
"Users can update their own saved withdrawal addresses"
on public.saved_withdrawal_addresses;

create policy
"Users can update their own saved withdrawal addresses"
on public.saved_withdrawal_addresses
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists
"Users can delete their own saved withdrawal addresses"
on public.saved_withdrawal_addresses;

create policy
"Users can delete their own saved withdrawal addresses"
on public.saved_withdrawal_addresses
for delete
to authenticated
using (user_id = auth.uid());

-- ============================================================
-- 11. PROFILE RLS
--
-- Ensure users can maintain their own Settings profile fields.
--
-- Existing policies are preserved.
-- ============================================================

alter table public.profiles enable row level security;

drop policy if exists
"Users can update their own settings profile"
on public.profiles;

create policy
"Users can update their own settings profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- ============================================================
-- 12. EMAIL VERIFICATION SYNCHRONIZATION
--
-- Supabase Auth is the source of truth.
--
-- auth.users.email_confirmed_at IS NOT NULL
--        =>
-- profiles.verification_status = 'verified'
--
-- Otherwise:
-- profiles.verification_status = 'pending'
--
-- We intentionally do NOT allow users to manually set
-- verification_status through Settings.
-- ============================================================

create or replace function public.sync_profile_email_verification(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_confirmed_at timestamptz;
begin

  select email_confirmed_at
  into v_confirmed_at
  from auth.users
  where id = p_user_id;

  if v_confirmed_at is not null then

    update public.profiles
    set
      verification_status = 'verified',
      updated_at = now()
    where id = p_user_id;

  else

    update public.profiles
    set
      verification_status = 'pending',
      updated_at = now()
    where id = p_user_id;

  end if;

end;
$$;

-- ============================================================
-- 13. SECURE FUNCTION TO CHECK CURRENT USER VERIFICATION
-- ============================================================

create or replace function public.get_my_email_verification_status()
returns table (
  email text,
  email_confirmed_at timestamptz,
  is_verified boolean
)
language sql
security definer
set search_path = public, auth
as $$
  select
    u.email,
    u.email_confirmed_at,
    (u.email_confirmed_at is not null) as is_verified
  from auth.users u
  where u.id = auth.uid();
$$;

revoke all
on function public.get_my_email_verification_status()
from public;

grant execute
on function public.get_my_email_verification_status()
to authenticated;

-- ============================================================
-- 14. INITIAL SYNCHRONIZATION
--
-- Synchronize existing profiles immediately.
-- ============================================================

update public.profiles p
set
  verification_status =
    case
      when u.email_confirmed_at is not null
        then 'verified'
      else 'pending'
    end,
  updated_at = now()
from auth.users u
where u.id = p.id;

-- ============================================================
-- 15. HELPER VIEW FOR SETTINGS
--
-- Gives the frontend a clean view of the user's saved addresses
-- together with the wallet/network information.
-- ============================================================

create or replace view public.my_saved_withdrawal_addresses
with (security_invoker = true)
as
select
  swa.id,
  swa.user_id,
  swa.wallet_option_id,
  swa.label,
  swa.wallet_address,
  swa.is_preferred,
  swa.is_verified,
  swa.created_at,
  swa.updated_at,

  wwo.asset_code,
  wwo.asset_name,
  wwo.network_code,
  wwo.network_name,
  wwo.address_label

from public.saved_withdrawal_addresses swa
join public.withdrawal_wallet_options wwo
  on wwo.id = swa.wallet_option_id
where swa.user_id = auth.uid();

-- ============================================================
-- 16. GRANTS FOR THE VIEW
-- ============================================================

revoke all
on public.my_saved_withdrawal_addresses
from anon;

grant select
on public.my_saved_withdrawal_addresses
to authenticated;

-- ============================================================
-- 17. SEED EXAMPLES
--
-- These are ONLY enabled wallet/network options.
-- They do not create user addresses or balances.
--
-- Remove any option you don't intend to support.
-- ============================================================

insert into public.withdrawal_wallet_options
  (
    asset_code,
    asset_name,
    network_code,
    network_name,
    address_label,
    is_enabled,
    display_order
  )
values
  (
    'BTC',
    'Bitcoin',
    'BITCOIN',
    'Bitcoin',
    'Bitcoin address',
    true,
    10
  ),
  (
    'ETH',
    'Ethereum',
    'ETHEREUM',
    'Ethereum',
    'Ethereum address',
    true,
    20
  ),
  (
    'USDT',
    'Tether',
    'TRC20',
    'Tron TRC20',
    'USDT TRC20 address',
    true,
    30
  ),
  (
    'USDT',
    'Tether',
    'ERC20',
    'Ethereum ERC20',
    'USDT ERC20 address',
    true,
    40
  ),
  (
    'USDT',
    'Tether',
    'BEP20',
    'BNB Smart Chain',
    'USDT BEP20 address',
    true,
    50
  ),
  (
    'BNB',
    'BNB',
    'BEP20',
    'BNB Smart Chain',
    'BNB BEP20 address',
    true,
    60
  ),
  (
    'SOL',
    'Solana',
    'SOLANA',
    'Solana',
    'Solana address',
    true,
    70
  ),
  (
    'XRP',
    'XRP',
    'XRP',
    'XRP Ledger',
    'XRP address',
    true,
    80
  ),
  (
    'USDC',
    'USD Coin',
    'ERC20',
    'Ethereum ERC20',
    'USDC ERC20 address',
    true,
    90
  ),
  (
    'ADA',
    'Cardano',
    'CARDANO',
    'Cardano',
    'Cardano address',
    true,
    100
  ),
  (
    'DOGE',
    'Dogecoin',
    'DOGECOIN',
    'Dogecoin',
    'Dogecoin address',
    true,
    110
  ),
  (
    'AVAX',
    'Avalanche',
    'AVALANCHE',
    'Avalanche C-Chain',
    'Avalanche address',
    true,
    120
  )
on conflict (asset_code, network_code)
do update set
  asset_name = excluded.asset_name,
  network_name = excluded.network_name,
  address_label = excluded.address_label,
  display_order = excluded.display_order,
  updated_at = now();

-- ============================================================
-- 18. COMMENTS
-- ============================================================

comment on table public.withdrawal_wallet_options is
'Admin-controlled list of cryptocurrency wallet/network combinations that users may save as withdrawal destinations.';

comment on table public.saved_withdrawal_addresses is
'User-owned saved withdrawal destinations. These do not hold funds and do not themselves authorize a withdrawal.';

comment on column public.saved_withdrawal_addresses.is_preferred is
'Marks the users preferred saved destination for the specific asset/network.';

comment on column public.saved_withdrawal_addresses.is_verified is
'Administrative verification flag for the saved destination. This is separate from email/account verification.';

comment on column public.profiles.avatar_url is
'Public/storage URL for the users profile picture.';

comment on column public.profiles.email_notifications_enabled is
'Controls optional account email notifications.';

comment on column public.profiles.security_alerts_enabled is
'Controls security-related account notifications.';

comment on column public.profiles.preferred_currency is
'Users preferred display currency for supported interface values.';

comment on column public.profiles.timezone is
'Users preferred timezone for displaying dates and times.';

commit;