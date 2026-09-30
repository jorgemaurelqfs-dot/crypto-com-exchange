-- CRYPTO COM EXCHANGE
-- User-facing deposit wallet registry
-- Source of truth: public.wallet_configurations

create or replace function public.get_user_deposit_wallets()
returns table (
  id uuid,
  asset_symbol text,
  asset_name text,
  network text,
  wallet_address text,
  wallet_label text,
  qr_code_url text,
  instructions text,
  deposit_tag text,
  maintenance_mode boolean,
  maintenance_message text,
  required_confirmations integer
)
language sql
security definer
set search_path = public
stable
as $$
  select
    wc.id,
    wc.asset_symbol,
    wc.asset_name,
    wc.network,
    nullif(trim(wc.deposit_address), '') as wallet_address,
    wc.asset_name as wallet_label,
    null::text as qr_code_url,
    wc.description as instructions,
    wc.deposit_tag,
    coalesce(wc.maintenance_mode, false) as maintenance_mode,
    wc.maintenance_message,
    coalesce(wc.required_confirmations, 0)::integer as required_confirmations
  from public.wallet_configurations wc
  where wc.is_active = true
    and wc.deposits_enabled = true
  order by wc.display_order asc, wc.asset_symbol asc, wc.network asc;
$$;

revoke all on function public.get_user_deposit_wallets() from public;
grant execute on function public.get_user_deposit_wallets() to authenticated;

comment on function public.get_user_deposit_wallets() is
'User-facing deposit wallet registry. Reads active deposit-enabled configurations from wallet_configurations without exposing administrative fields.';
