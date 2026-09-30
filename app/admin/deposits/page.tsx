"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import "./deposits.css";

type Deposit = {
  id: string;
  reference: string;
  user_id: string;
  account_id: string | null;
  username: string | null;
  full_name: string | null;
  email: string | null;
  asset_symbol: string;
  network: string;
  amount: number;
  wallet_id: string | null;
  wallet_address: string | null;
  wallet_label: string | null;
  transaction_hash: string | null;
  status: string;
  user_note: string | null;
  admin_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewer_email: string | null;
  created_at: string;
  updated_at: string;
};

type AuditEntry = {
  id: string;
  deposit_id: string;
  admin_id: string;
  admin_email: string | null;
  previous_status: string | null;
  new_status: string;
  admin_note: string | null;
  created_at: string;
};

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "confirming", label: "Confirming" },
  { value: "confirmed", label: "Confirmed" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

const ASSETS = [
  "BTC",
  "ETH",
  "USDT",
  "BNB",
  "SOL",
  "XRP",
  "USDC",
  "ADA",
  "DOGE",
  "AVAX",
];

function formatAmount(value: number | string | null, asset: string) {
  const amount = Number(value || 0);

  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 12,
  }).format(amount)} ${asset}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function shortHash(value: string | null) {
  if (!value) return "Not supplied";

  if (value.length <= 22) {
    return value;
  }

  return `${value.slice(0, 11)}…${value.slice(-9)}`;
}

function statusLabel(status: string) {
  if (!status) return "Unknown";

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusClass(status: string) {
  return `deposit-status status-${status || "unknown"}`;
}

export default function AdminDepositsPage() {
  const router = useRouter();
  const pathname = usePathname();

  const supabase = useMemo(() => createClient(), []);

  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [selectedDeposit, setSelectedDeposit] = useState<Deposit | null>(
    null
  );
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [asset, setAsset] = useState("");
  const [network, setNetwork] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const [adminNote, setAdminNote] = useState("");

  const [page, setPage] = useState(0);

  const pageSize = 25;

  const [total, setTotal] = useState(0);

  /*
   * ---------------------------------------------------------
   * LOAD DEPOSITS
   * ---------------------------------------------------------
   */
  const loadDeposits = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      /*
       * Always verify the browser session first.
       *
       * This is important because auth.uid() is NULL inside the
       * Supabase SQL editor, but it should resolve to the logged-in
       * user's UUID when this RPC is called from the website.
       */
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(userError.message);
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      /*
       * Verify the authenticated browser user is an administrator.
       */
      const { data: isAdmin, error: adminError } =
        await supabase.rpc("is_admin");

      if (adminError) {
        throw new Error(adminError.message);
      }

      if (!isAdmin) {
        router.replace("/dashboard");
        return;
      }

      /*
       * Convert date filters into PostgreSQL timestamptz values.
       */
      const from =
        fromDate.trim() !== ""
          ? new Date(`${fromDate}T00:00:00`).toISOString()
          : null;

      const to =
        toDate.trim() !== ""
          ? new Date(`${toDate}T23:59:59.999`).toISOString()
          : null;

      /*
       * IMPORTANT:
       * These parameter names MUST exactly match the SQL RPC.
       */
      const { data, error: depositsError } = await supabase.rpc(
        "admin_get_deposits",
        {
          p_search: search.trim() || null,
          p_status: status || null,
          p_asset_symbol: asset || null,
          p_network: network.trim() || null,
          p_user_id: null,
          p_from_date: from,
          p_to_date: to,
          p_limit: pageSize,
          p_offset: page * pageSize,
        }
      );

      if (depositsError) {
        throw new Error(depositsError.message);
      }

      /*
       * Load the total separately for pagination.
       */
      const { data: countData, error: countError } =
        await supabase.rpc("admin_count_deposits", {
          p_search: search.trim() || null,
          p_status: status || null,
          p_asset_symbol: asset || null,
          p_network: network.trim() || null,
          p_user_id: null,
          p_from_date: from,
          p_to_date: to,
        });

      if (countError) {
        throw new Error(countError.message);
      }

      const rows = (data || []) as Deposit[];

      setDeposits(rows);
      setTotal(Number(countData || 0));

      /*
       * Keep the selected deposit synchronized with the newly
       * loaded database record.
       */
      if (selectedDeposit) {
        const refreshedSelected = rows.find(
          (deposit) => deposit.id === selectedDeposit.id
        );

        if (refreshedSelected) {
          setSelectedDeposit(refreshedSelected);
          setAdminNote(refreshedSelected.admin_note || "");
        } else {
          /*
           * It may have disappeared because the current filters
           * changed. In that case clear the detail panel.
           */
          setSelectedDeposit(null);
          setAuditEntries([]);
          setAdminNote("");
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load deposit management."
      );
    } finally {
      setLoading(false);
    }
  }, [
    supabase,
    router,
    search,
    status,
    asset,
    network,
    fromDate,
    toDate,
    page,
    selectedDeposit,
  ]);

  /*
   * ---------------------------------------------------------
   * LOAD AUDIT HISTORY
   * ---------------------------------------------------------
   */
  const loadAudit = useCallback(
    async (deposit: Deposit) => {
      setAuditLoading(true);
      setError("");

      try {
        const { data, error: auditError } = await supabase.rpc(
          "admin_get_deposit_audit",
          {
            p_deposit_id: deposit.id,
          }
        );

        if (auditError) {
          throw new Error(auditError.message);
        }

        setAuditEntries((data || []) as AuditEntry[]);
      } catch (err) {
        setAuditEntries([]);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load deposit review history."
        );
      } finally {
        setAuditLoading(false);
      }
    },
    [supabase]
  );

  /*
   * ---------------------------------------------------------
   * INITIAL / FILTERED LOAD
   * ---------------------------------------------------------
   */
  useEffect(() => {
    loadDeposits();
  }, [loadDeposits]);

  /*
   * ---------------------------------------------------------
   * SELECT DEPOSIT
   * ---------------------------------------------------------
   */
  const selectDeposit = async (deposit: Deposit) => {
    setSelectedDeposit(deposit);
    setAdminNote(deposit.admin_note || "");
    setActionMessage("");
    setError("");

    await loadAudit(deposit);
  };

  /*
   * ---------------------------------------------------------
   * CHANGE DEPOSIT STATUS
   * ---------------------------------------------------------
   */
  const changeStatus = async (newStatus: string) => {
    if (!selectedDeposit) return;

    setActionLoading(true);
    setError("");
    setActionMessage("");

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "admin_set_deposit_status",
        {
          p_deposit_id: selectedDeposit.id,
          p_status: newStatus,
          p_admin_note: adminNote.trim() || null,
        }
      );

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      if (!data?.success) {
        throw new Error(
          data?.message ||
            "The deposit action could not be completed."
        );
      }

      setActionMessage(
        `Deposit ${selectedDeposit.reference} is now ${statusLabel(
          newStatus
        )}.`
      );

      /*
       * Reload the table from the database.
       *
       * The previous implementation attempted to find the updated
       * record from the old React state immediately after calling
       * loadDeposits(). Because state updates are asynchronous,
       * that could leave the detail panel stale.
       */
      await loadDeposits();

      /*
       * Reload the audit trail directly using the existing selected
       * deposit ID. This avoids depending on stale state.
       */
      const updatedDeposit: Deposit = {
        ...selectedDeposit,
        status: newStatus,
        admin_note: adminNote.trim() || selectedDeposit.admin_note,
        reviewed_at: new Date().toISOString(),
      };

      setSelectedDeposit(updatedDeposit);

      await loadAudit(updatedDeposit);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update the deposit."
      );
    } finally {
      setActionLoading(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * FILTER HELPERS
   * ---------------------------------------------------------
   */
  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setAsset("");
    setNetwork("");
    setFromDate("");
    setToDate("");
    setPage(0);
    setSelectedDeposit(null);
    setAuditEntries([]);
    setAdminNote("");
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  /*
   * These statistics describe the records currently visible
   * on the loaded page.
   */
  const pendingCount = deposits.filter(
    (deposit) => deposit.status === "pending"
  ).length;

  const confirmingCount = deposits.filter(
    (deposit) => deposit.status === "confirming"
  ).length;

  const confirmedCount = deposits.filter(
    (deposit) => deposit.status === "confirmed"
  ).length;

  const visibleAmount = deposits.reduce(
    (sum, deposit) => sum + Number(deposit.amount || 0),
    0
  );

  return (
    <main className="deposit-admin-app">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <div className="admin-logo-mark">C</div>

          <div>
            <strong>CRYPTO-COM</strong>
            <span>ADMIN CENTER</span>
          </div>
        </div>

        <div className="admin-menu-label">MAIN MENU</div>

        <nav className="admin-navigation">
          <Link
            href="/admin"
            className={`admin-nav-link ${
              pathname === "/admin" ? "active" : ""
            }`}
          >
            <span className="admin-nav-icon">▦</span>
            <span className="admin-nav-copy">
              <strong>Dashboard</strong>
              <small>Overview & activity</small>
            </span>
          </Link>

          <Link
            href="/admin/users"
            className={`admin-nav-link ${
              pathname.startsWith("/admin/users") ? "active" : ""
            }`}
          >
            <span className="admin-nav-icon">◉</span>
            <span className="admin-nav-copy">
              <strong>Users</strong>
              <small>Manage accounts</small>
            </span>
          </Link>

          <Link
            href="/admin/balances"
            className={`admin-nav-link ${
              pathname.startsWith("/admin/balances") ? "active" : ""
            }`}
          >
            <span className="admin-nav-icon">◆</span>
            <span className="admin-nav-copy">
              <strong>Balance Management</strong>
              <small>Add, subtract & bonus</small>
            </span>
          </Link>

          <Link
            href="/admin/deposits"
            className="admin-nav-link active"
          >
            <span className="admin-nav-icon">↓</span>

            <span className="admin-nav-copy">
              <strong>Deposits</strong>
              <small>Review deposits</small>
            </span>
          </Link>

          <Link
            href="/admin/withdrawals"
            className="admin-nav-link"
          >
            <span className="admin-nav-icon">↑</span>

            <span className="admin-nav-copy">
              <strong>Withdrawals</strong>
              <small>Process withdrawals</small>
            </span>
          </Link>

          <Link
            href="/admin/wallets"
            className="admin-nav-link"
          >
            <span className="admin-nav-icon">▣</span>

            <span className="admin-nav-copy">
              <strong>Wallet Configuration</strong>
              <small>Deposit addresses</small>
            </span>
          </Link>

          <Link
            href="/admin/investments"
            className="admin-nav-link"
          >
            <span className="admin-nav-icon">◈</span>

            <span className="admin-nav-copy">
              <strong>Investments</strong>
              <small>User investments</small>
            </span>
          </Link>

          <Link
            href="/admin/investment-plans"
            className="admin-nav-link"
          >
            <span className="admin-nav-icon">◇</span>

            <span className="admin-nav-copy">
              <strong>Investment Plans</strong>
              <small>Manage plans</small>
            </span>
          </Link>

          <Link
            href="/admin/swaps"
            className="admin-nav-link"
          >
            <span className="admin-nav-icon">⇄</span>

            <span className="admin-nav-copy">
              <strong>Swap Management</strong>
              <small>Swap activity</small>
            </span>
          </Link>

          <Link
            href="/admin/transactions"
            className="admin-nav-link"
          >
            <span className="admin-nav-icon">≡</span>

            <span className="admin-nav-copy">
              <strong>Transactions</strong>
              <small>Ledger & history</small>
            </span>
          </Link>

          <Link
            href="/admin/verification"
            className="admin-nav-link"
          >
            <span className="admin-nav-icon">✓</span>

            <span className="admin-nav-copy">
              <strong>Verification</strong>
              <small>Account verification</small>
            </span>
          </Link>

          <Link
            href="/admin/settings"
            className="admin-nav-link"
          >
            <span className="admin-nav-icon">⚙</span>

            <span className="admin-nav-copy">
              <strong>Platform Settings</strong>
              <small>System configuration</small>
            </span>
          </Link>
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-security-status">
            <span className="security-indicator" />

            <div>
              <strong>SECURE SESSION</strong>
              <small>Administrator authenticated</small>
            </div>
          </div>

          <button
            type="button"
            className="admin-signout"
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace("/login");
            }}
          >
            <span>↪</span>
            Sign out
          </button>
        </div>
      </aside>

      <section className="deposit-admin-main">
        <header className="deposit-topbar">
          <div>
            <span className="deposit-breadcrumb">
              ADMINISTRATION / DEPOSITS
            </span>

            <h1>Deposit Management</h1>

            <p>
              Review, verify and manage incoming cryptocurrency
              deposit requests across the exchange.
            </p>
          </div>

          <button
            type="button"
            className="deposit-refresh"
            onClick={loadDeposits}
            disabled={loading}
          >
            ↻ {loading ? "Refreshing..." : "Refresh"}
          </button>
        </header>

        {error && (
          <div className="deposit-alert error">
            <strong>Deposit Management Error</strong>
            <span>{error}</span>
          </div>
        )}

        {actionMessage && (
          <div className="deposit-alert success">
            <strong>Action completed</strong>
            <span>{actionMessage}</span>
          </div>
        )}

        <section className="deposit-stat-grid">
          <div className="deposit-stat-card">
            <div className="deposit-stat-icon">↓</div>

            <div>
              <span>VISIBLE DEPOSITS</span>
              <strong>{total}</strong>
              <small>Matching current filters</small>
            </div>
          </div>

          <div className="deposit-stat-card pending">
            <div className="deposit-stat-icon">◷</div>

            <div>
              <span>PENDING</span>
              <strong>{pendingCount}</strong>
              <small>Awaiting review</small>
            </div>
          </div>

          <div className="deposit-stat-card confirming">
            <div className="deposit-stat-icon">◌</div>

            <div>
              <span>CONFIRMING</span>
              <strong>{confirmingCount}</strong>
              <small>Blockchain confirmation</small>
            </div>
          </div>

          <div className="deposit-stat-card confirmed">
            <div className="deposit-stat-icon">✓</div>

            <div>
              <span>CONFIRMED</span>
              <strong>{confirmedCount}</strong>
              <small>Confirmed on this page</small>
            </div>
          </div>

          <div className="deposit-stat-card featured">
            <div className="deposit-stat-icon">₿</div>

            <div>
              <span>VISIBLE VOLUME</span>

              <strong>
                {new Intl.NumberFormat("en-US", {
                  maximumFractionDigits: 8,
                }).format(visibleAmount)}
              </strong>

              <small>Across selected assets</small>
            </div>
          </div>
        </section>

        <section className="deposit-panel filters-panel">
          <div className="panel-heading">
            <div>
              <span>QUERY ENGINE</span>
              <h2>Deposit Search & Filters</h2>
            </div>

            <button
              type="button"
              className="clear-filters"
              onClick={clearFilters}
            >
              Reset filters
            </button>
          </div>

          <div className="deposit-filter-grid">
            <label className="filter-search">
              <span>Search</span>

              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
                placeholder="Reference, email, account, username or TX hash..."
              />
            </label>

            <label>
              <span>Status</span>

              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(0);
                }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Asset</span>

              <select
                value={asset}
                onChange={(event) => {
                  setAsset(event.target.value);
                  setPage(0);
                }}
              >
                <option value="">All assets</option>

                {ASSETS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Network</span>

              <input
                value={network}
                onChange={(event) => {
                  setNetwork(event.target.value);
                  setPage(0);
                }}
                placeholder="e.g. TRC20"
              />
            </label>

            <label>
              <span>From date</span>

              <input
                type="date"
                value={fromDate}
                onChange={(event) => {
                  setFromDate(event.target.value);
                  setPage(0);
                }}
              />
            </label>

            <label>
              <span>To date</span>

              <input
                type="date"
                value={toDate}
                onChange={(event) => {
                  setToDate(event.target.value);
                  setPage(0);
                }}
              />
            </label>
          </div>
        </section>

        <section className="deposit-workspace">
          <div className="deposit-list-panel deposit-panel">
            <div className="panel-heading">
              <div>
                <span>INCOMING TRANSFERS</span>
                <h2>Deposit Requests</h2>
              </div>

              <small>
                Page {page + 1} of {totalPages}
              </small>
            </div>

            {loading ? (
              <div className="deposit-loading">
                <div className="deposit-loader" />

                <span>Loading deposit records...</span>
              </div>
            ) : deposits.length === 0 ? (
              <div className="deposit-empty">
                <div>↓</div>

                <h3>No deposits found</h3>

                <p>
                  No deposit requests match the current search and
                  filters.
                </p>
              </div>
            ) : (
              <div className="deposit-table-wrap">
                <table className="deposit-table">
                  <thead>
                    <tr>
                      <th>Deposit</th>
                      <th>User</th>
                      <th>Asset</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Submitted</th>
                    </tr>
                  </thead>

                  <tbody>
                    {deposits.map((deposit) => (
                      <tr
                        key={deposit.id}
                        className={
                          selectedDeposit?.id === deposit.id
                            ? "selected"
                            : ""
                        }
                        onClick={() => selectDeposit(deposit)}
                      >
                        <td>
                          <div className="deposit-reference">
                            <strong>{deposit.reference}</strong>

                            <small>
                              {shortHash(
                                deposit.transaction_hash
                              )}
                            </small>
                          </div>
                        </td>

                        <td>
                          <div className="deposit-user">
                            <strong>
                              {deposit.full_name ||
                                deposit.username ||
                                "Unnamed user"}
                            </strong>

                            <small>
                              {deposit.email ||
                                deposit.account_id ||
                                "—"}
                            </small>
                          </div>
                        </td>

                        <td>
                          <div className="asset-cell">
                            <strong>
                              {deposit.asset_symbol}
                            </strong>

                            <small>{deposit.network}</small>
                          </div>
                        </td>

                        <td>
                          <strong className="amount-cell">
                            {formatAmount(
                              deposit.amount,
                              deposit.asset_symbol
                            )}
                          </strong>
                        </td>

                        <td>
                          <span
                            className={statusClass(
                              deposit.status
                            )}
                          >
                            <i />
                            {statusLabel(deposit.status)}
                          </span>
                        </td>

                        <td>
                          <span className="date-cell">
                            {formatDate(deposit.created_at)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pagination">
              <button
                type="button"
                disabled={page === 0 || loading}
                onClick={() =>
                  setPage((current) =>
                    Math.max(0, current - 1)
                  )
                }
              >
                ← Previous
              </button>

              <span>
                {page + 1} / {totalPages}
              </span>

              <button
                type="button"
                disabled={
                  page + 1 >= totalPages || loading
                }
                onClick={() =>
                  setPage((current) => current + 1)
                }
              >
                Next →
              </button>
            </div>
          </div>

          <aside className="deposit-detail-panel deposit-panel">
            {!selectedDeposit ? (
              <div className="detail-placeholder">
                <div className="placeholder-icon">↓</div>

                <h2>Select a deposit</h2>

                <p>
                  Select a deposit request from the list to
                  inspect its complete details, blockchain
                  information and review history.
                </p>

                <div className="placeholder-line" />
                <div className="placeholder-line short" />
                <div className="placeholder-line shorter" />
              </div>
            ) : (
              <>
                <div className="detail-header">
                  <div>
                    <span>DEPOSIT REQUEST</span>

                    <h2>{selectedDeposit.reference}</h2>
                  </div>

                  <span
                    className={statusClass(
                      selectedDeposit.status
                    )}
                  >
                    <i />
                    {statusLabel(selectedDeposit.status)}
                  </span>
                </div>

                <div className="detail-amount-card">
                  <span>DEPOSIT AMOUNT</span>

                  <strong>
                    {formatAmount(
                      selectedDeposit.amount,
                      selectedDeposit.asset_symbol
                    )}
                  </strong>

                  <small>
                    {selectedDeposit.asset_symbol} ·{" "}
                    {selectedDeposit.network}
                  </small>
                </div>

                <div className="detail-section">
                  <div className="detail-section-title">
                    <span>USER ACCOUNT</span>
                  </div>

                  <div className="identity-card">
                    <div className="identity-avatar">
                      {(
                        selectedDeposit.full_name ||
                        selectedDeposit.username ||
                        selectedDeposit.email ||
                        "U"
                      )
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div>
                      <strong>
                        {selectedDeposit.full_name ||
                          selectedDeposit.username ||
                          "Unnamed user"}
                      </strong>

                      <span>
                        {selectedDeposit.email ||
                          "Email unavailable"}
                      </span>

                      <small>
                        Account ID:{" "}
                        {selectedDeposit.account_id ||
                          "Not available"}
                      </small>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <div className="detail-section-title">
                    <span>BLOCKCHAIN DATA</span>
                  </div>

                  <div className="detail-data-grid">
                    <div>
                      <span>Asset</span>
                      <strong>
                        {selectedDeposit.asset_symbol}
                      </strong>
                    </div>

                    <div>
                      <span>Network</span>
                      <strong>
                        {selectedDeposit.network}
                      </strong>
                    </div>

                    <div className="full">
                      <span>Transaction Hash</span>

                      <code>
                        {selectedDeposit.transaction_hash ||
                          "Transaction hash not supplied"}
                      </code>
                    </div>

                    <div className="full">
                      <span>Deposit Wallet</span>

                      <code>
                        {selectedDeposit.wallet_address ||
                          "Wallet configuration unavailable"}
                      </code>
                    </div>

                    <div>
                      <span>Wallet Label</span>

                      <strong>
                        {selectedDeposit.wallet_label || "—"}
                      </strong>
                    </div>

                    <div>
                      <span>Submitted</span>

                      <strong>
                        {formatDate(
                          selectedDeposit.created_at
                        )}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <div className="detail-section-title">
                    <span>USER NOTE</span>
                  </div>

                  <div className="note-box">
                    {selectedDeposit.user_note ||
                      "No note was submitted with this deposit."}
                  </div>
                </div>

                <div className="detail-section">
                  <div className="detail-section-title">
                    <span>ADMIN REVIEW</span>
                  </div>

                  <label className="admin-note-label">
                    <span>Internal administrator note</span>

                    <textarea
                      value={adminNote}
                      onChange={(event) =>
                        setAdminNote(event.target.value)
                      }
                      placeholder="Record why this deposit was approved, rejected or placed under review..."
                      rows={4}
                    />
                  </label>

                  <div className="deposit-actions">
                    {selectedDeposit.status !==
                      "confirmed" &&
                      selectedDeposit.status !== "rejected" &&
                      selectedDeposit.status !== "cancelled" && (
                        <>
                          <button
                            type="button"
                            className="action-button confirming"
                            disabled={actionLoading}
                            onClick={() =>
                              changeStatus("confirming")
                            }
                          >
                            ◌ Mark Confirming
                          </button>

                          <button
                            type="button"
                            className="action-button approve"
                            disabled={actionLoading}
                            onClick={() =>
                              changeStatus("confirmed")
                            }
                          >
                            ✓ Confirm Deposit
                          </button>

                          <button
                            type="button"
                            className="action-button reject"
                            disabled={actionLoading}
                            onClick={() =>
                              changeStatus("rejected")
                            }
                          >
                            × Reject
                          </button>
                        </>
                      )}

                    {selectedDeposit.status === "pending" && (
                      <button
                        type="button"
                        className="action-button cancel"
                        disabled={actionLoading}
                        onClick={() =>
                          changeStatus("cancelled")
                        }
                      >
                        Cancel Request
                      </button>
                    )}
                  </div>
                </div>

                <div className="detail-section audit-section">
                  <div className="detail-section-title">
                    <span>REVIEW HISTORY</span>
                  </div>

                  {auditLoading ? (
                    <div className="audit-loading">
                      Loading review history...
                    </div>
                  ) : auditEntries.length === 0 ? (
                    <div className="audit-empty">
                      No administrator review actions have
                      been recorded.
                    </div>
                  ) : (
                    <div className="audit-timeline">
                      {auditEntries.map((entry) => (
                        <div
                          className="audit-entry"
                          key={entry.id}
                        >
                          <div className="audit-dot" />

                          <div className="audit-entry-content">
                            <div>
                              <strong>
                                {statusLabel(
                                  entry.new_status
                                )}
                              </strong>

                              <span>
                                {formatDate(
                                  entry.created_at
                                )}
                              </span>
                            </div>

                            <small>
                              Administrator:{" "}
                              {entry.admin_email ||
                                "Unknown"}
                            </small>

                            {entry.previous_status && (
                              <small>
                                Previous status:{" "}
                                {statusLabel(
                                  entry.previous_status
                                )}
                              </small>
                            )}

                            {entry.admin_note && (
                              <p>{entry.admin_note}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="detail-footer">
                  <span>
                    Deposit created{" "}
                    {formatDate(
                      selectedDeposit.created_at
                    )}
                  </span>

                  {selectedDeposit.reviewed_at && (
                    <span>
                      Last reviewed{" "}
                      {formatDate(
                        selectedDeposit.reviewed_at
                      )}
                    </span>
                  )}
                </div>
              </>
            )}
          </aside>
        </section>
      </section>
    </main>
  );
}