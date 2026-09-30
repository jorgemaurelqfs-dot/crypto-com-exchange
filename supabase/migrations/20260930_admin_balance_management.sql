/*
===========================================================
CRYPTO-COM EXCHANGE
ADMIN BALANCE MANAGEMENT / AUDIT / TRANSACTION LEDGER
===========================================================

Purpose:
- Allow authorized admins to add, subtract or bonus CCT.
- Record complete before/after balances.
- Record administrator identity.
- Allow a custom audit/transaction date.
- Reflect the exact same adjustment in public.transactions.
- Preserve an immutable audit trail.
===========================================================
*/

begin;

------------------------------------------------------------
-- 1. BALANCE AUDIT TABLE
------------------------------------------------------------

create table if not exists public.admin_balance_adjustments (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  admin_id uuid not null
    references auth.users(id),

  action text not null
    check (
      action in (
        'add',
        'subtract',
        'bonus'
      )
    ),

  amount numeric(38,18) not null
    check (amount > 0),

  balance_before numeric(38,18) not null,

  balance_after numeric(38,18) not null,

  reason text not null,

  /*
   * The administrator-selected accounting/audit date.
   */
  audit_at timestamptz not null default now(),

  /*
   * Links this audit record to the transaction ledger.
   */
  transaction_id uuid null,

  created_at timestamptz not null default now()
);

------------------------------------------------------------
-- 2. INDEXES
------------------------------------------------------------

create index if not exists idx_admin_balance_adjustments_user
on public.admin_balance_adjustments(user_id);

create index if not exists idx_admin_balance_adjustments_admin
on public.admin_balance_adjustments(admin_id);

create index if not exists idx_admin_balance_adjustments_audit_at
on public.admin_balance_adjustments(audit_at desc);

create index if not exists idx_admin_balance_adjustments_created_at
on public.admin_balance_adjustments(created_at desc);

create index if not exists idx_admin_balance_adjustments_transaction
on public.admin_balance_adjustments(transaction_id);

------------------------------------------------------------
-- 3. ENABLE RLS
------------------------------------------------------------

alter table public.admin_balance_adjustments
enable row level security;

------------------------------------------------------------
-- 4. REMOVE DIRECT CLIENT ACCESS
------------------------------------------------------------

revoke all
on public.admin_balance_adjustments
from anon;

revoke all
on public.admin_balance_adjustments
from authenticated;

------------------------------------------------------------
-- 5. ADMIN BALANCE ADJUSTMENT RPC
------------------------------------------------------------

create or replace function public.admin_adjust_cct_balance(
  p_user_id uuid,
  p_action text,
  p_amount numeric,
  p_reason text,
  p_audit_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_action text;
  v_reason text;
  v_audit_at timestamptz;

  v_balance_before numeric(38,18);
  v_balance_after numeric(38,18);

  v_transaction_id uuid;
  v_reference text;

  v_wallet_exists boolean;
begin

  ----------------------------------------------------------
  -- ADMIN AUTHORIZATION
  ----------------------------------------------------------

  v_admin_id := auth.uid();

  if v_admin_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  ----------------------------------------------------------
  -- NORMALIZE INPUT
  ----------------------------------------------------------

  v_action := lower(trim(coalesce(p_action, '')));
  v_reason := trim(coalesce(p_reason, ''));

  if p_amount is null or p_amount <= 0 then
    raise exception 'Adjustment amount must be greater than zero';
  end if;

  if v_action not in ('add', 'subtract', 'bonus') then
    raise exception 'Invalid balance adjustment action';
  end if;

  if v_reason = '' then
    raise exception 'A reason is required for every balance adjustment';
  end if;

  /*
   * Preserve the administrator-selected date.
   * If no date was supplied, use the current timestamp.
   */
  v_audit_at := coalesce(p_audit_at, now());

  ----------------------------------------------------------
  -- VERIFY USER
  ----------------------------------------------------------

  if not exists (
    select 1
    from public.profiles
    where id = p_user_id
  ) then
    raise exception 'User profile does not exist';
  end if;

  ----------------------------------------------------------
  -- LOCK USER CCT WALLET
  ----------------------------------------------------------

  select exists (
    select 1
    from public.cct_wallets
    where user_id = p_user_id
  )
  into v_wallet_exists;

  if not v_wallet_exists then
    raise exception 'CCT wallet does not exist for this user';
  end if;

  select available_balance
  into v_balance_before
  from public.cct_wallets
  where user_id = p_user_id
  for update;

  ----------------------------------------------------------
  -- CALCULATE NEW BALANCE
  ----------------------------------------------------------

  if v_action in ('add', 'bonus') then

    v_balance_after :=
      v_balance_before + p_amount;

  elsif v_action = 'subtract' then

    if v_balance_before < p_amount then
      raise exception
        'Insufficient available CCT balance for subtraction';
    end if;

    v_balance_after :=
      v_balance_before - p_amount;

  end if;

  ----------------------------------------------------------
  -- UPDATE WALLET
  ----------------------------------------------------------

  update public.cct_wallets
  set
    available_balance = v_balance_after
  where user_id = p_user_id;

  ----------------------------------------------------------
  -- TRANSACTION REFERENCE
  ----------------------------------------------------------

  v_reference :=
    'ADM-' ||
    upper(substr(
      replace(gen_random_uuid()::text, '-', ''),
      1,
      12
    ));

  ----------------------------------------------------------
  -- CREATE TRANSACTION LEDGER ENTRY
  --
  -- The transaction receives the SAME audit date.
  ----------------------------------------------------------

  insert into public.transactions (
    id,
    user_id,
    reference,
    transaction_type,
    direction,
    amount,
    balance_before,
    balance_after,
    description,
    status,
    created_at
  )
  values (
    gen_random_uuid(),
    p_user_id,
    v_reference,
    'adjustment',

    case
      when v_action in ('add', 'bonus')
        then 'credit'
      else
        'debit'
    end,

    p_amount,
    v_balance_before,
    v_balance_after,

    case
      when v_action = 'bonus'
        then 'Administrator bonus: ' || v_reason
      when v_action = 'add'
        then 'Administrator balance adjustment: ' || v_reason
      else
        'Administrator balance subtraction: ' || v_reason
    end,

    'completed',

    v_audit_at
  )
  returning id
  into v_transaction_id;

  ----------------------------------------------------------
  -- CREATE ADMIN AUDIT RECORD
  ----------------------------------------------------------

  insert into public.admin_balance_adjustments (
    user_id,
    admin_id,
    action,
    amount,
    balance_before,
    balance_after,
    reason,
    audit_at,
    transaction_id
  )
  values (
    p_user_id,
    v_admin_id,
    v_action,
    p_amount,
    v_balance_before,
    v_balance_after,
    v_reason,
    v_audit_at,
    v_transaction_id
  );

  ----------------------------------------------------------
  -- RETURN RESULT
  ----------------------------------------------------------

  return jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'admin_id', v_admin_id,
    'action', v_action,
    'amount', p_amount,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after,
    'reason', v_reason,
    'audit_at', v_audit_at,
    'transaction_id', v_transaction_id,
    'reference', v_reference
  );

end;
$$;

------------------------------------------------------------
-- 6. ADMIN AUDIT HISTORY RPC
------------------------------------------------------------

create or replace function public.admin_get_balance_adjustments(
  p_user_id uuid default null,
  p_limit integer default 50,
  p_offset integer default 0,
  p_start_at timestamptz default null,
  p_end_at timestamptz default null
)
returns table (
  id uuid,
  user_id uuid,
  admin_id uuid,
  action text,
  amount numeric,
  balance_before numeric,
  balance_after numeric,
  reason text,
  audit_at timestamptz,
  transaction_id uuid,
  created_at timestamptz,

  user_account_id text,
  user_username text,
  user_full_name text,
  user_email text,

  admin_email text
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin

  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  p_limit := greatest(1, least(coalesce(p_limit, 50), 100));
  p_offset := greatest(0, coalesce(p_offset, 0));

  return query

  select
    a.id,
    a.user_id,
    a.admin_id,
    a.action,
    a.amount,
    a.balance_before,
    a.balance_after,
    a.reason,
    a.audit_at,
    a.transaction_id,
    a.created_at,

    p.account_id,
    p.username,
    p.full_name,
    u.email,

    au.email

  from public.admin_balance_adjustments a

  left join public.profiles p
    on p.id = a.user_id

  left join auth.users u
    on u.id = a.user_id

  left join auth.users au
    on au.id = a.admin_id

  where
    (p_user_id is null or a.user_id = p_user_id)

    and
    (
      p_start_at is null
      or a.audit_at >= p_start_at
    )

    and
    (
      p_end_at is null
      or a.audit_at <= p_end_at
    )

  order by a.audit_at desc

  limit p_limit
  offset p_offset;

end;
$$;

------------------------------------------------------------
-- 7. TRANSACTION LOOKUP FOR AUDIT
------------------------------------------------------------

create or replace function public.admin_get_balance_transaction(
  p_transaction_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_result jsonb;
begin

  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  select jsonb_build_object(
    'id', t.id,
    'user_id', t.user_id,
    'reference', t.reference,
    'transaction_type', t.transaction_type,
    'direction', t.direction,
    'amount', t.amount,
    'balance_before', t.balance_before,
    'balance_after', t.balance_after,
    'description', t.description,
    'status', t.status,
    'created_at', t.created_at
  )
  into v_result
  from public.transactions t
  where t.id = p_transaction_id;

  return coalesce(
    v_result,
    jsonb_build_object(
      'success', false,
      'message', 'Transaction not found'
    )
  );

end;
$$;

------------------------------------------------------------
-- 8. RPC PERMISSIONS
------------------------------------------------------------

revoke all
on function public.admin_adjust_cct_balance(
  uuid,
  text,
  numeric,
  text,
  timestamptz
)
from public;

revoke all
on function public.admin_adjust_cct_balance(
  uuid,
  text,
  numeric,
  text,
  timestamptz
)
from anon;

grant execute
on function public.admin_adjust_cct_balance(
  uuid,
  text,
  numeric,
  text,
  timestamptz
)
to authenticated;


revoke all
on function public.admin_get_balance_adjustments(
  uuid,
  integer,
  integer,
  timestamptz,
  timestamptz
)
from public;

revoke all
on function public.admin_get_balance_adjustments(
  uuid,
  integer,
  integer,
  timestamptz,
  timestamptz
)
from anon;

grant execute
on function public.admin_get_balance_adjustments(
  uuid,
  integer,
  integer,
  timestamptz,
  timestamptz
)
to authenticated;


revoke all
on function public.admin_get_balance_transaction(
  uuid
)
from public;

revoke all
on function public.admin_get_balance_transaction(
  uuid
)
from anon;

grant execute
on function public.admin_get_balance_transaction(
  uuid
)
to authenticated;

commit;