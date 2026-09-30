-- =========================================================
-- CRYPTO COM EXCHANGE
-- ADMIN WITHDRAWAL MANAGEMENT
-- =========================================================
--
-- Provides:
--
-- 1. Admin withdrawal listing/search RPC
-- 2. Secure admin withdrawal status-management RPC
-- 3. Atomic wallet debit when a withdrawal is completed
-- 4. Asset transaction ledger entry
--
-- IMPORTANT:
-- The browser NEVER directly changes wallet balances.
-- All completion/debit operations happen inside PostgreSQL.
-- =========================================================


-- =========================================================
-- INDEXES
-- =========================================================

create index if not exists withdrawals_admin_status_created_idx
  on public.withdrawals (status, created_at desc);

create index if not exists withdrawals_admin_asset_created_idx
  on public.withdrawals (asset_symbol, created_at desc);

create index if not exists withdrawals_admin_reference_idx
  on public.withdrawals (reference);

create index if not exists withdrawals_admin_user_idx
  on public.withdrawals (user_id);


-- =========================================================
-- ADMIN WITHDRAWAL LIST
-- =========================================================

create or replace function public.admin_get_withdrawals(
  p_status text default null,
  p_search text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  id uuid,
  reference text,
  user_id uuid,

  account_id text,
  username text,
  full_name text,

  account_status text,
  verification_status text,

  asset_symbol text,
  network text,
  amount numeric,
  fee numeric,

  destination_address text,
  destination_tag text,

  status text,
  transaction_hash text,

  user_note text,
  admin_note text,

  created_at timestamptz,
  updated_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid
)
language plpgsql
security definer
set search_path = ''
as $function$

declare
  v_admin_id uuid;
  v_status text;
  v_search text;

begin

  -- =======================================================
  -- AUTHENTICATION
  -- =======================================================

  v_admin_id := auth.uid();

  if v_admin_id is null then
    raise exception 'Authentication required.';
  end if;


  -- =======================================================
  -- ADMIN CHECK
  -- =======================================================

  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;


  -- =======================================================
  -- NORMALIZE FILTERS
  -- =======================================================

  v_status :=
    nullif(lower(trim(coalesce(p_status, ''))), '');

  v_search :=
    nullif(lower(trim(coalesce(p_search, ''))), '');


  -- =======================================================
  -- LIMIT / OFFSET PROTECTION
  -- =======================================================

  if p_limit is null or p_limit < 1 then
    p_limit := 100;
  end if;

  if p_limit > 500 then
    p_limit := 500;
  end if;

  if p_offset is null or p_offset < 0 then
    p_offset := 0;
  end if;


  -- =======================================================
  -- RETURN WITHDRAWALS
  -- =======================================================

  return query

  select
    w.id,
    w.reference,
    w.user_id,

    p.account_id,
    p.username,
    p.full_name,

    p.account_status,
    p.verification_status,

    w.asset_symbol,
    w.network,
    w.amount,
    w.fee,

    w.destination_address,
    w.destination_tag,

    w.status,
    w.transaction_hash,

    w.user_note,
    w.admin_note,

    w.created_at,
    w.updated_at,
    w.reviewed_at,
    w.reviewed_by

  from public.withdrawals w

  left join public.profiles p
    on p.id = w.user_id

  where
    (
      v_status is null
      or lower(w.status) = v_status
    )

    and

    (
      v_search is null

      or lower(coalesce(w.reference, '')) like '%' || v_search || '%'

      or lower(coalesce(p.account_id, '')) like '%' || v_search || '%'

      or lower(coalesce(p.username, '')) like '%' || v_search || '%'

      or lower(coalesce(p.full_name, '')) like '%' || v_search || '%'

      or lower(coalesce(w.asset_symbol, '')) like '%' || v_search || '%'

      or lower(coalesce(w.destination_address, '')) like '%' || v_search || '%'
    )

  order by
    w.created_at desc

  limit p_limit
  offset p_offset;

end;

$function$;


-- =========================================================
-- ADMIN WITHDRAWAL STATUS / PROCESSING RPC
-- =========================================================
--
-- Allowed transitions:
--
-- pending    -> processing
-- pending    -> rejected
-- pending    -> cancelled
--
-- processing -> completed
-- processing -> rejected
-- processing -> cancelled
--
-- completed / rejected / cancelled are terminal.
--
-- COMPLETING a withdrawal:
--
-- 1. Locks withdrawal row
-- 2. Confirms admin
-- 3. Locks wallet
-- 4. Checks available balance
-- 5. Debits amount + fee
-- 6. Creates asset_transactions entry
-- 7. Updates withdrawal
--
-- Everything happens in one database transaction.
-- =========================================================

create or replace function public.admin_set_withdrawal_status(
  p_withdrawal_id uuid,
  p_status text,
  p_admin_note text default null,
  p_transaction_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$

declare

  v_admin_id uuid;

  v_withdrawal public.withdrawals%rowtype;

  v_wallet_balance_before numeric(38,18);
  v_wallet_balance_after numeric(38,18);

  v_total_debit numeric(38,18);

  v_transaction_id uuid;
  v_transaction_reference text;

  v_status text;

  v_admin_note text;
  v_transaction_hash text;

begin

  -- =======================================================
  -- AUTHENTICATION
  -- =======================================================

  v_admin_id := auth.uid();

  if v_admin_id is null then
    raise exception 'Authentication required.';
  end if;


  -- =======================================================
  -- ADMIN AUTHORIZATION
  -- =======================================================

  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;


  -- =======================================================
  -- NORMALIZE INPUT
  -- =======================================================

  v_status :=
    lower(trim(coalesce(p_status, '')));

  v_admin_note :=
    nullif(trim(coalesce(p_admin_note, '')), '');

  v_transaction_hash :=
    nullif(trim(coalesce(p_transaction_hash, '')), '');


  -- =======================================================
  -- VALIDATE STATUS
  -- =======================================================

  if v_status not in (
    'pending',
    'processing',
    'completed',
    'rejected',
    'cancelled'
  ) then

    raise exception
      'Invalid withdrawal status.';

  end if;


  -- =======================================================
  -- LOCK WITHDRAWAL
  -- =======================================================

  select *
  into v_withdrawal

  from public.withdrawals

  where id = p_withdrawal_id

  for update;


  if not found then
    raise exception 'Withdrawal request not found.';
  end if;


  -- =======================================================
  -- TERMINAL STATUS PROTECTION
  -- =======================================================

  if v_withdrawal.status in (
    'completed',
    'rejected',
    'cancelled'
  ) then

    if v_status <> v_withdrawal.status then

      raise exception
        'This withdrawal is already finalized with status "%".',
        v_withdrawal.status;

    end if;

  end if;


  -- =======================================================
  -- TRANSITION VALIDATION
  -- =======================================================

  if v_withdrawal.status = 'pending' then

    if v_status not in (
      'processing',
      'rejected',
      'cancelled',
      'pending'
    ) then

      raise exception
        'A pending withdrawal can only become processing, rejected or cancelled.';

    end if;

  elsif v_withdrawal.status = 'processing' then

    if v_status not in (
      'completed',
      'rejected',
      'cancelled',
      'processing'
    ) then

      raise exception
        'A processing withdrawal can only become completed, rejected or cancelled.';

    end if;

  elsif v_withdrawal.status = 'completed' then

    if v_status <> 'completed' then
      raise exception
        'Completed withdrawals cannot be reopened.';
    end if;

  elsif v_withdrawal.status = 'rejected' then

    if v_status <> 'rejected' then
      raise exception
        'Rejected withdrawals cannot be reopened.';
    end if;

  elsif v_withdrawal.status = 'cancelled' then

    if v_status <> 'cancelled' then
      raise exception
        'Cancelled withdrawals cannot be reopened.';
    end if;

  end if;


  -- =======================================================
  -- NO-OP
  -- =======================================================

  if v_status = v_withdrawal.status
     and v_status <> 'completed' then

    update public.withdrawals

    set
      admin_note = coalesce(
        v_admin_note,
        admin_note
      ),

      transaction_hash = coalesce(
        v_transaction_hash,
        transaction_hash
      ),

      updated_at = now(),

      reviewed_at = now(),

      reviewed_by = v_admin_id

    where id = v_withdrawal.id;


    return jsonb_build_object(
      'success', true,
      'withdrawal_id', v_withdrawal.id,
      'reference', v_withdrawal.reference,
      'status', v_status,
      'message', 'Withdrawal updated.'
    );

  end if;


  -- =======================================================
  -- COMPLETION
  -- =======================================================

  if v_status = 'completed' then

    -- -----------------------------------------------------
    -- VALIDATE TRANSACTION HASH
    -- -----------------------------------------------------

    if v_transaction_hash is null then

      raise exception
        'A transaction hash is required when completing a withdrawal.';

    end if;


    -- -----------------------------------------------------
    -- VALIDATE AMOUNT
    -- -----------------------------------------------------

    if v_withdrawal.amount is null
       or v_withdrawal.amount <= 0 then

      raise exception
        'Withdrawal amount must be greater than zero.';

    end if;


    -- -----------------------------------------------------
    -- VALIDATE FEE
    -- -----------------------------------------------------

    if v_withdrawal.fee is null
       or v_withdrawal.fee < 0 then

      raise exception
        'Withdrawal fee cannot be negative.';

    end if;


    -- -----------------------------------------------------
    -- TOTAL AMOUNT DEBITED
    -- -----------------------------------------------------

    v_total_debit :=
      v_withdrawal.amount +
      v_withdrawal.fee;


    if v_total_debit <= 0 then

      raise exception
        'Total withdrawal debit must be greater than zero.';

    end if;


    -- -----------------------------------------------------
    -- CCT IS NOT A DIRECT WITHDRAWAL ASSET
    -- -----------------------------------------------------

    if upper(v_withdrawal.asset_symbol) = 'CCT' then

      raise exception
        'CCT cannot be withdrawn directly.';

    end if;


    -- -----------------------------------------------------
    -- LOCK EXTERNAL ASSET WALLET
    -- -----------------------------------------------------

    select available_balance

    into v_wallet_balance_before

    from public.asset_wallets

    where user_id = v_withdrawal.user_id

      and upper(asset_symbol) =
          upper(v_withdrawal.asset_symbol)

    for update;


    if not found then

      raise exception
        'Asset wallet for % was not found.',
        v_withdrawal.asset_symbol;

    end if;


    -- -----------------------------------------------------
    -- CHECK AVAILABLE BALANCE
    -- -----------------------------------------------------

    if v_wallet_balance_before < v_total_debit then

      raise exception
        'Insufficient % balance. Available: %, required: %.',
        v_withdrawal.asset_symbol,
        v_wallet_balance_before,
        v_total_debit;

    end if;


    -- -----------------------------------------------------
    -- CALCULATE NEW BALANCE
    -- -----------------------------------------------------

    v_wallet_balance_after :=
      v_wallet_balance_before -
      v_total_debit;


    if v_wallet_balance_after < 0 then

      raise exception
        'Invalid wallet balance calculation.';

    end if;


    -- -----------------------------------------------------
    -- UPDATE WALLET
    -- -----------------------------------------------------

    update public.asset_wallets

    set
      available_balance = v_wallet_balance_after,
      updated_at = now()

    where user_id = v_withdrawal.user_id

      and upper(asset_symbol) =
          upper(v_withdrawal.asset_symbol);


    -- -----------------------------------------------------
    -- CREATE LEDGER REFERENCE
    -- -----------------------------------------------------

    v_transaction_reference :=
      public.generate_asset_transaction_reference();


    -- -----------------------------------------------------
    -- CREATE ASSET LEDGER ENTRY
    -- -----------------------------------------------------
    --
    -- The ledger amount represents the full wallet debit:
    -- withdrawal amount + withdrawal fee.
    --
    -- This ensures the before/after balance matches the
    -- actual wallet movement.
    -- -----------------------------------------------------

    insert into public.asset_transactions (
      reference,
      user_id,
      asset_symbol,
      transaction_type,
      direction,
      amount,
      balance_before,
      balance_after,
      related_withdrawal_id,
      description,
      status
    )

    values (
      v_transaction_reference,
      v_withdrawal.user_id,
      upper(v_withdrawal.asset_symbol),
      'withdrawal',
      'debit',
      v_total_debit,
      v_wallet_balance_before,
      v_wallet_balance_after,
      v_withdrawal.id,

      case
        when v_withdrawal.fee > 0 then
          'Withdrawal ' ||
          v_withdrawal.reference ||
          ' — amount ' ||
          v_withdrawal.amount ||
          ' + fee ' ||
          v_withdrawal.fee

        else
          'Withdrawal ' ||
          v_withdrawal.reference
      end,

      'completed'
    )

    returning id
    into v_transaction_id;


    -- -----------------------------------------------------
    -- COMPLETE WITHDRAWAL
    -- -----------------------------------------------------

    update public.withdrawals

    set
      status = 'completed',

      transaction_hash =
        v_transaction_hash,

      admin_note =
        coalesce(
          v_admin_note,
          admin_note
        ),

      reviewed_at = now(),

      reviewed_by = v_admin_id,

      updated_at = now()

    where id = v_withdrawal.id;


    -- -----------------------------------------------------
    -- RETURN COMPLETION RESULT
    -- -----------------------------------------------------

    return jsonb_build_object(

      'success', true,

      'withdrawal_id',
      v_withdrawal.id,

      'reference',
      v_withdrawal.reference,

      'status',
      'completed',

      'asset_symbol',
      upper(v_withdrawal.asset_symbol),

      'amount',
      v_withdrawal.amount,

      'fee',
      v_withdrawal.fee,

      'total_debit',
      v_total_debit,

      'balance_before',
      v_wallet_balance_before,

      'balance_after',
      v_wallet_balance_after,

      'transaction_id',
      v_transaction_id,

      'transaction_reference',
      v_transaction_reference,

      'transaction_hash',
      v_transaction_hash,

      'reviewed_by',
      v_admin_id,

      'completed_at',
      now()

    );

  end if;


  -- =======================================================
  -- NON-COMPLETION STATUS UPDATE
  -- =======================================================

  update public.withdrawals

  set
    status = v_status,

    admin_note =
      coalesce(
        v_admin_note,
        admin_note
      ),

    transaction_hash =
      coalesce(
        v_transaction_hash,
        transaction_hash
      ),

    reviewed_at = now(),

    reviewed_by = v_admin_id,

    updated_at = now()

  where id = v_withdrawal.id;


  -- =======================================================
  -- RETURN
  -- =======================================================

  return jsonb_build_object(

    'success', true,

    'withdrawal_id',
    v_withdrawal.id,

    'reference',
    v_withdrawal.reference,

    'status',
    v_status,

    'reviewed_by',
    v_admin_id,

    'reviewed_at',
    now()

  );

end;

$function$;


-- =========================================================
-- FUNCTION PERMISSIONS
-- =========================================================

revoke execute
on function public.admin_get_withdrawals(
  text,
  text,
  integer,
  integer
)
from public, anon;

grant execute
on function public.admin_get_withdrawals(
  text,
  text,
  integer,
  integer
)
to authenticated;


revoke execute
on function public.admin_set_withdrawal_status(
  uuid,
  text,
  text,
  text
)
from public, anon;

grant execute
on function public.admin_set_withdrawal_status(
  uuid,
  text,
  text,
  text
)
to authenticated;


-- =========================================================
-- COMMENTS
-- =========================================================

comment on function public.admin_get_withdrawals(
  text,
  text,
  integer,
  integer
)
is
'Admin-only withdrawal management listing with user/profile information.';


comment on function public.admin_set_withdrawal_status(
  uuid,
  text,
  text,
  text
)
is
'Admin-only withdrawal status management. Completing a withdrawal atomically debits the user asset wallet and creates an asset transaction ledger entry.';