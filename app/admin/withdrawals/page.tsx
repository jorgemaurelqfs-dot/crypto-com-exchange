"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "./withdrawals.css";
import BrandLogo from "../../../components/BrandLogo";
import { createClient } from "../../../lib/supabase/client";

type Withdrawal = {
  id: string;
  reference: string;
  user_id: string;

  account_id: string | null;
  username: string | null;
  full_name: string | null;

  account_status: string | null;
  verification_status: string | null;

  asset_symbol: string;
  network: string;
  amount: number | string;
  fee: number | string;

  destination_address: string;
  destination_tag: string | null;

  status: string;
  transaction_hash: string | null;

  user_note: string | null;
  admin_note: string | null;

  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

type Action = {
  withdrawal: Withdrawal;
  status: "processing" | "completed" | "rejected" | "cancelled";
};

const STATUS_FILTERS = [
  "all",
  "pending",
  "processing",
  "completed",
  "rejected",
  "cancelled",
] as const;

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAmount(
  value: number | string | null | undefined
): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(toNumber(value));
}

function formatUSD(
  value: number | string | null | undefined
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortenAddress(
  value: string | null | undefined
): string {
  if (!value) {
    return "—";
  }

  if (value.length <= 22) {
    return value;
  }

  return `${value.slice(0, 11)}...${value.slice(-9)}`;
}

function statusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function assetIcon(symbol: string): string {
  switch (symbol.toUpperCase()) {
    case "BTC":
      return "₿";

    case "ETH":
      return "Ξ";

    case "USDT":
      return "₮";

    case "BNB":
      return "◆";

    case "SOL":
      return "S";

    case "XRP":
      return "X";

    case "USDC":
      return "$";

    case "ADA":
      return "₳";

    case "DOGE":
      return "Ð";

    case "AVAX":
      return "A";

    case "CCT":
      return "C";

    default:
      return symbol.slice(0, 1).toUpperCase();
  }
}

function displayUser(withdrawal: Withdrawal): string {
  return (
    withdrawal.username ||
    withdrawal.full_name ||
    withdrawal.account_id ||
    "Unknown user"
  );
}

export default function AdminWithdrawalsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedWithdrawal, setSelectedWithdrawal] =
    useState<Withdrawal | null>(null);

  const [action, setAction] = useState<Action | null>(null);

  const [adminNote, setAdminNote] = useState("");
  const [transactionHash, setTransactionHash] =
    useState("");

  const [detailsOpen, setDetailsOpen] = useState(false);

  async function ensureAdmin(): Promise<boolean> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      router.push("/login");
      return false;
    }

    const { data, error: adminError } =
      await supabase.rpc("is_admin");

    if (adminError) {
      throw new Error(adminError.message);
    }

    if (!data) {
      router.push("/dashboard");
      return false;
    }

    return true;
  }

  async function loadWithdrawals(
    showSpinner = true
  ) {
    if (showSpinner) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError("");

    try {
      const isAdmin = await ensureAdmin();

      if (!isAdmin) {
        return;
      }

      const { data, error: withdrawalError } =
        await supabase.rpc("admin_get_withdrawals", {
          p_status:
            statusFilter === "all"
              ? null
              : statusFilter,

          p_search:
            search.trim() || null,

          p_limit: 500,
          p_offset: 0,
        });

      if (withdrawalError) {
        throw new Error(withdrawalError.message);
      }

      setWithdrawals((data ?? []) as Withdrawal[]);
    } catch (loadError) {
      console.error(loadError);

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load withdrawals."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadWithdrawals();
  }, [statusFilter]);

  const statistics = useMemo(() => {
    const pending = withdrawals.filter(
      (item) => item.status === "pending"
    ).length;

    const processing = withdrawals.filter(
      (item) => item.status === "processing"
    ).length;

    const completed = withdrawals.filter(
      (item) => item.status === "completed"
    ).length;

    const rejected = withdrawals.filter(
      (item) => item.status === "rejected"
    ).length;

    const pendingValue = withdrawals
      .filter(
        (item) =>
          item.status === "pending" ||
          item.status === "processing"
      )
      .reduce(
        (total, item) =>
          total + toNumber(item.amount),
        0
      );

    return {
      pending,
      processing,
      completed,
      rejected,
      pendingValue,
    };
  }, [withdrawals]);

  const filteredWithdrawals = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return withdrawals;
    }

    return withdrawals.filter((item) => {
      return (
        item.reference.toLowerCase().includes(query) ||
        (item.account_id ?? "")
          .toLowerCase()
          .includes(query) ||
        (item.username ?? "")
          .toLowerCase()
          .includes(query) ||
        (item.full_name ?? "")
          .toLowerCase()
          .includes(query) ||
        item.asset_symbol
          .toLowerCase()
          .includes(query) ||
        item.destination_address
          .toLowerCase()
          .includes(query)
      );
    });
  }, [withdrawals, search]);

  function openDetails(withdrawal: Withdrawal) {
    setSelectedWithdrawal(withdrawal);
    setDetailsOpen(true);
  }

  function closeDetails() {
    if (submitting) {
      return;
    }

    setDetailsOpen(false);
    setSelectedWithdrawal(null);
  }

  function openAction(
    withdrawal: Withdrawal,
    nextStatus:
      | "processing"
      | "completed"
      | "rejected"
      | "cancelled"
  ) {
    setSelectedWithdrawal(withdrawal);

    setAdminNote(withdrawal.admin_note ?? "");
    setTransactionHash(
      withdrawal.transaction_hash ?? ""
    );

    setAction({
      withdrawal,
      status: nextStatus,
    });
  }

  function closeAction() {
    if (submitting) {
      return;
    }

    setAction(null);
    setAdminNote("");
    setTransactionHash("");
  }

  async function confirmAction() {
    if (!action) {
      return;
    }

    const withdrawal = action.withdrawal;

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      if (
        action.status === "completed" &&
        !transactionHash.trim()
      ) {
        throw new Error(
          "A transaction hash is required before completing a withdrawal."
        );
      }

      const { data, error: rpcError } =
        await supabase.rpc(
          "admin_set_withdrawal_status",
          {
            p_withdrawal_id: withdrawal.id,
            p_status: action.status,
            p_admin_note:
              adminNote.trim() || null,
            p_transaction_hash:
              transactionHash.trim() || null,
          }
        );

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      const result = data as {
        success?: boolean;
        reference?: string;
        status?: string;
        transaction_reference?: string;
        total_debit?: number | string;
        balance_after?: number | string;
      };

      if (action.status === "completed") {
        setSuccess(
          `Withdrawal ${result.reference ?? withdrawal.reference} completed successfully. ${
            result.transaction_reference
              ? `Ledger reference: ${result.transaction_reference}.`
              : ""
          }`
        );
      } else {
        setSuccess(
          `Withdrawal ${
            result.reference ?? withdrawal.reference
          } is now ${statusLabel(action.status)}.`
        );
      }

      closeAction();

      await loadWithdrawals(false);
    } catch (actionError) {
      console.error(actionError);

      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to update the withdrawal."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="dashboard-shell admin-withdrawals-app">
      <aside
        className={`dashboard-sidebar ${
          sidebarOpen ? "open" : ""
        }`}
      >
        <div className="dashboard-sidebar-brand">
          <BrandLogo />
        </div>

        <nav className="dashboard-nav">
          <Link
            href="/admin"
            onClick={() => setSidebarOpen(false)}
          >
            <span>⌂</span>
            <span>Admin Dashboard</span>
          </Link>

          <Link
            href="/admin/users"
            onClick={() => setSidebarOpen(false)}
          >
            <span>♙</span>
            <span>Users</span>
          </Link>

          <Link
            href="/admin/deposits"
            onClick={() => setSidebarOpen(false)}
          >
            <span>＋</span>
            <span>Deposits</span>
          </Link>

          <Link
            href="/admin/withdrawals"
            className="active"
            onClick={() => setSidebarOpen(false)}
          >
            <span>↗</span>
            <span>Withdrawals</span>
          </Link>

          <Link
            href="/admin/transactions"
            onClick={() => setSidebarOpen(false)}
          >
            <span>≡</span>
            <span>Transactions</span>
          </Link>

          <Link
            href="/admin/investments"
            onClick={() => setSidebarOpen(false)}
          >
            <span>◈</span>
            <span>Investments</span>
          </Link>

          <Link
            href="/admin/verifications"
            onClick={() => setSidebarOpen(false)}
          >
            <span>✓</span>
            <span>Verifications</span>
          </Link>

          <Link
            href="/admin/audit-log"
            onClick={() => setSidebarOpen(false)}
          >
            <span>⌁</span>
            <span>Audit Log</span>
          </Link>

          <Link
            href="/admin/settings"
            onClick={() => setSidebarOpen(false)}
          >
            <span>⚙</span>
            <span>Settings</span>
          </Link>
        </nav>

        <div className="dashboard-sidebar-bottom">
          <button
            type="button"
            className="dashboard-signout"
            onClick={handleSignOut}
          >
            <span>↪</span>
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="dashboard-sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="dashboard-main">
        <header className="dashboard-header">
          <button
            type="button"
            className="dashboard-menu-button"
            onClick={() =>
              setSidebarOpen((current) => !current)
            }
            aria-label="Open navigation"
          >
            <span />
            <span />
            <span />
          </button>

          <div className="dashboard-header-copy">
            <span>ADMINISTRATION</span>
            <strong>Withdrawal management</strong>
          </div>

          <div className="dashboard-header-account">
            <span>Administrator</span>

            <div className="dashboard-account-avatar">
              A
            </div>
          </div>
        </header>

        <div className="dashboard-content">
          <section className="dashboard-welcome-row">
            <div>
              <span className="dashboard-eyebrow">
                FINANCIAL OPERATIONS
              </span>

              <h1>Withdrawals</h1>

              <p>
                Review, process and complete customer
                withdrawal requests.
              </p>
            </div>

            <button
              type="button"
              className="admin-withdraw-refresh-button"
              onClick={() => loadWithdrawals(false)}
              disabled={refreshing || loading}
            >
              <span
                className={
                  refreshing
                    ? "admin-refresh-icon spinning"
                    : "admin-refresh-icon"
                }
              >
                ↻
              </span>

              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </section>

          {error && (
            <div
              className="admin-withdraw-alert admin-withdraw-alert-error"
              role="alert"
            >
              <div className="admin-withdraw-alert-icon">
                !
              </div>

              <div>
                <strong>Operation failed</strong>
                <span>{error}</span>
              </div>

              <button
                type="button"
                onClick={() => setError("")}
              >
                ×
              </button>
            </div>
          )}

          {success && (
            <div
              className="admin-withdraw-alert admin-withdraw-alert-success"
              role="status"
            >
              <div className="admin-withdraw-alert-icon">
                ✓
              </div>

              <div>
                <strong>Withdrawal updated</strong>
                <span>{success}</span>
              </div>

              <button
                type="button"
                onClick={() => setSuccess("")}
              >
                ×
              </button>
            </div>
          )}

          <section className="admin-withdraw-stat-grid">
            <div className="admin-withdraw-stat-card">
              <span>Pending</span>
              <strong>{statistics.pending}</strong>
              <small>Awaiting review</small>
            </div>

            <div className="admin-withdraw-stat-card">
              <span>Processing</span>
              <strong>{statistics.processing}</strong>
              <small>Currently being handled</small>
            </div>

            <div className="admin-withdraw-stat-card">
              <span>Completed</span>
              <strong>{statistics.completed}</strong>
              <small>Successfully processed</small>
            </div>

            <div className="admin-withdraw-stat-card">
              <span>Pending value</span>
              <strong>
                {formatAmount(statistics.pendingValue)}
              </strong>
              <small>Asset units across open requests</small>
            </div>
          </section>

          <section className="admin-withdraw-toolbar-card">
            <div className="admin-withdraw-search">
              <span>⌕</span>

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search reference, account, user, asset or address..."
              />
            </div>

            <div className="admin-withdraw-filter">
              <label htmlFor="withdraw-status-filter">
                Status
              </label>

              <select
                id="withdraw-status-filter"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
              >
                {STATUS_FILTERS.map((status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status === "all"
                      ? "All withdrawals"
                      : statusLabel(status)}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-withdraw-result-count">
              {filteredWithdrawals.length}{" "}
              {filteredWithdrawals.length === 1
                ? "request"
                : "requests"}
            </div>
          </section>

          <section className="admin-withdraw-table-card">
            <div className="admin-withdraw-table-header">
              <div>
                <span className="dashboard-eyebrow">
                  WITHDRAWAL QUEUE
                </span>

                <h2>Customer requests</h2>
              </div>

              <div className="admin-withdraw-queue-indicator">
                <span />
                Live database
              </div>
            </div>

            {loading ? (
              <div className="admin-withdraw-loading">
                <div className="admin-withdraw-spinner" />
                <strong>Loading withdrawal queue...</strong>
                <span>
                  Checking administrator permissions and
                  retrieving requests.
                </span>
              </div>
            ) : filteredWithdrawals.length === 0 ? (
              <div className="admin-withdraw-empty">
                <div>↗</div>

                <strong>No withdrawals found</strong>

                <p>
                  There are no withdrawal requests matching
                  the current filter.
                </p>
              </div>
            ) : (
              <div className="admin-withdraw-table-wrap">
                <table className="admin-withdraw-table">
                  <thead>
                    <tr>
                      <th>Request</th>
                      <th>Customer</th>
                      <th>Asset</th>
                      <th>Amount</th>
                      <th>Destination</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredWithdrawals.map(
                      (withdrawal) => {
                        const amount = toNumber(
                          withdrawal.amount
                        );

                        const fee = toNumber(
                          withdrawal.fee
                        );

                        const total = amount + fee;

                        return (
                          <tr key={withdrawal.id}>
                            <td>
                              <button
                                type="button"
                                className="admin-withdraw-reference"
                                onClick={() =>
                                  openDetails(withdrawal)
                                }
                              >
                                {withdrawal.reference}
                              </button>

                              <small>
                                {withdrawal.account_id ||
                                  withdrawal.user_id.slice(
                                    0,
                                    12
                                  )}
                              </small>
                            </td>

                            <td>
                              <div className="admin-withdraw-user">
                                <strong>
                                  {displayUser(
                                    withdrawal
                                  )}
                                </strong>

                                <span>
                                  {withdrawal.verification_status
                                    ? statusLabel(
                                        withdrawal.verification_status
                                      )
                                    : "Unverified"}
                                </span>
                              </div>
                            </td>

                            <td>
                              <span className="admin-withdraw-asset">
                                <span>
                                  {assetIcon(
                                    withdrawal.asset_symbol
                                  )}
                                </span>

                                <strong>
                                  {withdrawal.asset_symbol}
                                </strong>

                                <small>
                                  {withdrawal.network}
                                </small>
                              </span>
                            </td>

                            <td>
                              <strong>
                                {formatAmount(amount)}
                              </strong>

                              <small>
                                {withdrawal.asset_symbol}
                              </small>

                              {fee > 0 && (
                                <em>
                                  Fee:{" "}
                                  {formatAmount(fee)}
                                </em>
                              )}
                            </td>

                            <td>
                              <button
                                type="button"
                                className="admin-withdraw-address"
                                onClick={() =>
                                  openDetails(withdrawal)
                                }
                                title={
                                  withdrawal.destination_address
                                }
                              >
                                {shortenAddress(
                                  withdrawal.destination_address
                                )}
                              </button>

                              {withdrawal.destination_tag && (
                                <small>
                                  Tag:{" "}
                                  {
                                    withdrawal.destination_tag
                                  }
                                </small>
                              )}
                            </td>

                            <td>
                              <span
                                className={`admin-withdraw-status status-${withdrawal.status.toLowerCase()}`}
                              >
                                <span />
                                {statusLabel(
                                  withdrawal.status
                                )}
                              </span>
                            </td>

                            <td>
                              <span className="admin-withdraw-date">
                                {formatDate(
                                  withdrawal.created_at
                                )}
                              </span>
                            </td>

                            <td>
                              <div className="admin-withdraw-actions">
                                <button
                                  type="button"
                                  className="admin-withdraw-view-button"
                                  onClick={() =>
                                    openDetails(
                                      withdrawal
                                    )
                                  }
                                >
                                  View
                                </button>

                                {withdrawal.status ===
                                  "pending" && (
                                  <button
                                    type="button"
                                    className="admin-withdraw-process-button"
                                    onClick={() =>
                                      openAction(
                                        withdrawal,
                                        "processing"
                                      )
                                    }
                                  >
                                    Process
                                  </button>
                                )}

                                {withdrawal.status ===
                                  "processing" && (
                                  <button
                                    type="button"
                                    className="admin-withdraw-complete-button"
                                    onClick={() =>
                                      openAction(
                                        withdrawal,
                                        "completed"
                                      )
                                    }
                                  >
                                    Complete
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>

      {detailsOpen &&
        selectedWithdrawal && (
          <div className="admin-withdraw-modal-backdrop">
            <div
              className="admin-withdraw-modal admin-withdraw-details-modal"
              role="dialog"
              aria-modal="true"
            >
              <div className="admin-withdraw-modal-header">
                <div>
                  <span className="dashboard-eyebrow">
                    WITHDRAWAL REQUEST
                  </span>

                  <h2>
                    {selectedWithdrawal.reference}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={closeDetails}
                  className="admin-withdraw-modal-close"
                >
                  ×
                </button>
              </div>

              <div className="admin-withdraw-details-status">
                <span
                  className={`admin-withdraw-status status-${selectedWithdrawal.status.toLowerCase()}`}
                >
                  <span />
                  {statusLabel(
                    selectedWithdrawal.status
                  )}
                </span>

                <small>
                  Created{" "}
                  {formatDate(
                    selectedWithdrawal.created_at
                  )}
                </small>
              </div>

              <div className="admin-withdraw-detail-grid">
                <div>
                  <span>Account ID</span>
                  <strong>
                    {selectedWithdrawal.account_id ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>Username</span>
                  <strong>
                    {selectedWithdrawal.username ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>Full name</span>
                  <strong>
                    {selectedWithdrawal.full_name ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>Account status</span>
                  <strong>
                    {selectedWithdrawal.account_status
                      ? statusLabel(
                          selectedWithdrawal.account_status
                        )
                      : "—"}
                  </strong>
                </div>

                <div>
                  <span>Verification</span>
                  <strong>
                    {selectedWithdrawal.verification_status
                      ? statusLabel(
                          selectedWithdrawal.verification_status
                        )
                      : "—"}
                  </strong>
                </div>

                <div>
                  <span>Asset</span>
                  <strong>
                    {selectedWithdrawal.asset_symbol}
                  </strong>
                </div>

                <div>
                  <span>Network</span>
                  <strong>
                    {selectedWithdrawal.network}
                  </strong>
                </div>

                <div>
                  <span>Amount</span>
                  <strong>
                    {formatAmount(
                      selectedWithdrawal.amount
                    )}{" "}
                    {selectedWithdrawal.asset_symbol}
                  </strong>
                </div>

                <div>
                  <span>Fee</span>
                  <strong>
                    {formatAmount(
                      selectedWithdrawal.fee
                    )}{" "}
                    {selectedWithdrawal.asset_symbol}
                  </strong>
                </div>

                <div>
                  <span>Total wallet debit</span>
                  <strong>
                    {formatAmount(
                      toNumber(
                        selectedWithdrawal.amount
                      ) +
                        toNumber(
                          selectedWithdrawal.fee
                        )
                    )}{" "}
                    {selectedWithdrawal.asset_symbol}
                  </strong>
                </div>
              </div>

              <div className="admin-withdraw-detail-block">
                <span>Destination address</span>

                <div className="admin-withdraw-address-full">
                  {
                    selectedWithdrawal.destination_address
                  }
                </div>
              </div>

              {selectedWithdrawal.destination_tag && (
                <div className="admin-withdraw-detail-block">
                  <span>Destination tag / memo</span>

                  <div>
                    {
                      selectedWithdrawal.destination_tag
                    }
                  </div>
                </div>
              )}

              {selectedWithdrawal.user_note && (
                <div className="admin-withdraw-note-box">
                  <span>User note</span>
                  <p>
                    {selectedWithdrawal.user_note}
                  </p>
                </div>
              )}

              {selectedWithdrawal.admin_note && (
                <div className="admin-withdraw-note-box">
                  <span>Admin note</span>
                  <p>
                    {selectedWithdrawal.admin_note}
                  </p>
                </div>
              )}

              {selectedWithdrawal.transaction_hash && (
                <div className="admin-withdraw-detail-block">
                  <span>Transaction hash</span>

                  <div className="admin-withdraw-hash">
                    {
                      selectedWithdrawal.transaction_hash
                    }
                  </div>
                </div>
              )}

              <div className="admin-withdraw-modal-actions">
                {selectedWithdrawal.status ===
                  "pending" && (
                  <>
                    <button
                      type="button"
                      className="admin-withdraw-danger-button"
                      onClick={() => {
                        setDetailsOpen(false);
                        openAction(
                          selectedWithdrawal,
                          "rejected"
                        );
                      }}
                    >
                      Reject
                    </button>

                    <button
                      type="button"
                      className="admin-withdraw-secondary-button"
                      onClick={() => {
                        setDetailsOpen(false);
                        openAction(
                          selectedWithdrawal,
                          "cancelled"
                        );
                      }}
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      className="admin-withdraw-primary-button"
                      onClick={() => {
                        setDetailsOpen(false);
                        openAction(
                          selectedWithdrawal,
                          "processing"
                        );
                      }}
                    >
                      Start processing
                    </button>
                  </>
                )}

                {selectedWithdrawal.status ===
                  "processing" && (
                  <>
                    <button
                      type="button"
                      className="admin-withdraw-danger-button"
                      onClick={() => {
                        setDetailsOpen(false);
                        openAction(
                          selectedWithdrawal,
                          "rejected"
                        );
                      }}
                    >
                      Reject
                    </button>

                    <button
                      type="button"
                      className="admin-withdraw-secondary-button"
                      onClick={() => {
                        setDetailsOpen(false);
                        openAction(
                          selectedWithdrawal,
                          "cancelled"
                        );
                      }}
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      className="admin-withdraw-primary-button"
                      onClick={() => {
                        setDetailsOpen(false);
                        openAction(
                          selectedWithdrawal,
                          "completed"
                        );
                      }}
                    >
                      Complete withdrawal
                    </button>
                  </>
                )}

                <button
                  type="button"
                  className="admin-withdraw-secondary-button"
                  onClick={closeDetails}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      {action && (
        <div className="admin-withdraw-modal-backdrop">
          <div
            className="admin-withdraw-modal admin-withdraw-action-modal"
            role="dialog"
            aria-modal="true"
          >
            <div className="admin-withdraw-modal-header">
              <div>
                <span className="dashboard-eyebrow">
                  ADMIN ACTION
                </span>

                <h2>
                  {statusLabel(action.status)}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeAction}
                className="admin-withdraw-modal-close"
                disabled={submitting}
              >
                ×
              </button>
            </div>

            <div className="admin-withdraw-action-summary">
              <div>
                <span>Reference</span>
                <strong>
                  {action.withdrawal.reference}
                </strong>
              </div>

              <div>
                <span>Asset</span>
                <strong>
                  {formatAmount(
                    action.withdrawal.amount
                  )}{" "}
                  {action.withdrawal.asset_symbol}
                </strong>
              </div>

              <div>
                <span>Destination</span>
                <strong>
                  {shortenAddress(
                    action.withdrawal
                      .destination_address
                  )}
                </strong>
              </div>
            </div>

            {action.status === "completed" ? (
              <div className="admin-withdraw-completion-warning">
                <div>!</div>

                <div>
                  <strong>
                    Completing this withdrawal moves
                    real wallet balance.
                  </strong>

                  <p>
                    The database will lock the customer's{" "}
                    {action.withdrawal.asset_symbol} wallet,
                    verify that the available balance covers
                    the withdrawal plus fee, debit the wallet,
                    create an asset transaction ledger entry,
                    and mark this withdrawal completed.
                  </p>
                </div>
              </div>
            ) : (
              <div className="admin-withdraw-action-message">
                <strong>
                  Change withdrawal status to{" "}
                  {statusLabel(action.status)}?
                </strong>

                <p>
                  This action will update the withdrawal
                  request and record the administrator who
                  performed the action.
                </p>
              </div>
            )}

            {action.status === "completed" && (
              <div className="admin-withdraw-form-field">
                <label htmlFor="transaction-hash">
                  Transaction hash{" "}
                  <span>*</span>
                </label>

                <input
                  id="transaction-hash"
                  type="text"
                  value={transactionHash}
                  onChange={(event) =>
                    setTransactionHash(
                      event.target.value
                    )
                  }
                  placeholder="Enter the blockchain transaction hash"
                  disabled={submitting}
                />

                <small>
                  Required before a withdrawal can be
                  completed.
                </small>
              </div>
            )}

            <div className="admin-withdraw-form-field">
              <label htmlFor="admin-note">
                Administrator note
              </label>

              <textarea
                id="admin-note"
                value={adminNote}
                onChange={(event) =>
                  setAdminNote(event.target.value)
                }
                placeholder="Optional internal note..."
                rows={4}
                disabled={submitting}
              />
            </div>

            <div className="admin-withdraw-modal-actions">
              <button
                type="button"
                className="admin-withdraw-secondary-button"
                onClick={closeAction}
                disabled={submitting}
              >
                Back
              </button>

              <button
                type="button"
                className={
                  action.status === "completed"
                    ? "admin-withdraw-primary-button"
                    : action.status === "rejected"
                    ? "admin-withdraw-danger-button"
                    : "admin-withdraw-primary-button"
                }
                onClick={confirmAction}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="admin-withdraw-button-spinner" />
                    Processing...
                  </>
                ) : (
                  <>
                    Confirm{" "}
                    {statusLabel(action.status)}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}